-- =====================================================================
-- 第5回 fix14：③ 記録のレシート（Final-03-Profile の 3〜5・8）
--   月ごと（と通算）の「新しく見つけたお店・いちばん行ったエリア・
--   夜と昼のひとり平均・dig の上がり幅」。自分の分だけ。
--   fix13 のあとに実行する
-- =====================================================================

-- dig の上がり幅を出すために、月のはじめの dig を残す
create table if not exists public.dig_months (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,                 -- その月の1日（日本時間）
  dig_start int not null,
  primary key (user_id, month)
);
alter table public.dig_months enable row level security;
drop policy if exists dig_months_read_own on public.dig_months;
create policy dig_months_read_own on public.dig_months for select to authenticated using (user_id = auth.uid());

-- dig が変わるたび、その月のはじめの値をまだ残していなければ残す
create or replace function public.mogu_mark_dig_month(p_user uuid, p_dig int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.dig_months (user_id, month, dig_start)
  values (p_user, date_trunc('month', public.mogu_jst_today())::date, p_dig)
  on conflict (user_id, month) do nothing
$$;
revoke all on function public.mogu_mark_dig_month(uuid, int) from public, anon;

-- fix13 の mogu_bump_likes に、月のはじめの dig を残す1行を足す
create or replace function public.mogu_bump_likes(p_owner uuid, p_voter uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likes int;
  v_old int;
  v_new int;
begin
  if p_owner is null or p_delta = 0 then return; end if;
  if p_voter is not null and p_voter = p_owner then return; end if;
  if p_voter is not null and exists (
       select 1 from auth.users u where u.id = p_voter and u.created_at > now() - interval '7 days'
     ) then
    return;
  end if;

  insert into public.user_coin_totals (user_id, likes_received)
  values (p_owner, greatest(p_delta, 0))
  on conflict (user_id) do update
    set likes_received = greatest(0, public.user_coin_totals.likes_received + p_delta),
        updated_at = now()
  returning likes_received, dig into v_likes, v_old;

  perform public.mogu_mark_dig_month(p_owner, v_old);   -- 上がる前の値を、その月のはじめとして残す

  v_new := public.mogu_dig_for(v_likes);
  if v_new <> v_old then
    update public.user_coin_totals set dig = v_new, updated_at = now() where user_id = p_owner;
    if v_new > v_old then
      insert into public.notifications (user_id, type, payload)
      values (p_owner, 'dig_up', jsonb_build_object('from', v_old, 'to', v_new));
    end if;
  end if;
end;
$$;
revoke all on function public.mogu_bump_likes(uuid, uuid, int) from public, anon;

-- 予算の段のまん中の金額（引き渡し書 §6-6 の8段）
create or replace function public.mogu_budget_mid(p_bucket int)
returns int
language sql
immutable
as $$
  select case p_bucket
    when 1 then 500 when 2 then 1500 when 3 then 2500 when 4 then 3500
    when 5 then 4500 when 6 then 6000 when 7 then 8500 when 8 then 12000
    else null end
$$;

-- ---------------------------------------------------------------------
-- 記録のレシート。p_month に月の1日を渡すと その月、null なら通算
-- ---------------------------------------------------------------------
create or replace function public.my_record(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_from date;
  v_to date;
  v_today date := public.mogu_jst_today();
  v_out jsonb;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;

  if p_month is null then
    select least(
             coalesce((select min(visited_on) from public.shop_visits where user_id = v_user), v_today),
             coalesce((select min(created_at)::date from public.shops where discoverer_id = v_user), v_today)
           ) into v_from;
    v_to := v_today;
  else
    v_from := date_trunc('month', p_month)::date;
    v_to := least(v_today, (v_from + interval '1 month - 1 day')::date);
  end if;

  select jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'whole', p_month is null,
    -- 新しく見つけたお店（自分が登録して、消されていないもの）
    'found', (
      select count(*) from public.shops s
       where s.discoverer_id = v_user and s.status <> 'deleted'
         and (s.created_at at time zone 'Asia/Tokyo')::date between v_from and v_to
    ),
    -- いちばん行ったエリア（行ったお店の駅）。上から3つ
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc, name)
        from (
          select st.name as name, count(*) as n
            from public.shop_visits v
            join public.shops s on s.id = v.shop_id
            join public.stations st on st.id = s.station_id
           where v.user_id = v_user and v.visited_on between v_from and v_to
           group by st.name
           order by n desc, st.name
           limit 3
        ) t
    ), '[]'::jsonb),
    -- 夜・昼のひとり平均（自分が入れた予算感の、段のまん中の金額を ¥1,000 きざみで）
    'dinner', (
      select round(avg(public.mogu_budget_mid(b.bucket)) / 1000.0) * 1000
        from public.budget_votes b
       where b.user_id = v_user and b.time_of_day = 'dinner'
         and (b.updated_at at time zone 'Asia/Tokyo')::date between v_from and v_to
    ),
    'lunch', (
      select round(avg(public.mogu_budget_mid(b.bucket)) / 1000.0) * 1000
        from public.budget_votes b
       where b.user_id = v_user and b.time_of_day = 'lunch'
         and (b.updated_at at time zone 'Asia/Tokyo')::date between v_from and v_to
    ),
    'dig_to', coalesce((select dig from public.user_coin_totals where user_id = v_user), 1),
    'dig_from', case
      when p_month is null then 1
      else coalesce(
        (select dig_start from public.dig_months where user_id = v_user and month = v_from),
        -- その月に1回も動いていなければ、前の月までの最後の値（なければ今の値）
        (select dig_start from public.dig_months where user_id = v_user and month > v_from order by month limit 1),
        (select dig from public.user_coin_totals where user_id = v_user),
        1)
    end
  ) into v_out;
  return v_out;
end;
$$;
revoke all on function public.my_record(date) from public, anon;
grant execute on function public.my_record(date) to authenticated;

-- レシートの月のタブに出す月（記録のある月を新しい順に）
create or replace function public.my_record_months()
returns table (month date)
language sql
stable
security definer
set search_path = public
as $$
  select m from (
    select date_trunc('month', visited_on)::date as m
      from public.shop_visits where user_id = auth.uid()
    union
    select date_trunc('month', (created_at at time zone 'Asia/Tokyo'))::date
      from public.shops where discoverer_id = auth.uid() and status <> 'deleted'
    union
    select date_trunc('month', public.mogu_jst_today())::date
  ) t
  order by m desc
  limit 12
$$;
revoke all on function public.my_record_months() from public, anon;
grant execute on function public.my_record_months() to authenticated;
