-- =====================================================================
-- 第5回 fix10：㉓ お店そのものの3つ（名前・ジャンル・最寄り駅）も直せるように
--   確定版 Final-23_04 の一覧には「お店の名前」「ジャンル」「最寄り駅」がある。
--   この3つは shop_fields ではなく shops の列なので、
--   submit_edit_request が「今の内容」を shops から取るようにする。
--   fix5 のあとに実行する（fix5 → fix6 → fix7 → fix8 → fix9 → fix10）。
-- =====================================================================

create or replace function public.submit_edit_request(
  p_shop_id uuid,
  p_field_key text,
  p_proposed text,
  p_how_known text default null,
  p_evidence text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current text;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_field_key is null or btrim(p_field_key) = '' then raise exception 'field_required'; end if;
  if p_proposed is null or btrim(p_proposed) = '' then raise exception 'proposed_required'; end if;
  if public.mogu_has_banned(p_proposed) then raise exception 'banned_word'; end if;
  if p_evidence is not null and public.mogu_has_banned(p_evidence) then raise exception 'banned_word'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;

  -- ほかの人の依頼を確かめているあいだは押せない（㉓-10・11）
  if exists (select 1 from public.edit_requests
              where shop_id = p_shop_id and field_key = p_field_key
                and status in ('open', 'checking')) then
    raise exception 'already_checking';
  end if;

  -- 今の内容。お店そのものの3つは shops から、ほかは shop_fields から
  if p_field_key = 'name' then
    select s.name into v_current from public.shops s where s.id = p_shop_id;
  elsif p_field_key = 'genre' then
    select concat_ws('・', s.genre_main, nullif(s.genre_sub, ''))
      into v_current from public.shops s where s.id = p_shop_id;
  elsif p_field_key = 'station' then
    select case when st.name is null then null
                else st.name || '駅 徒歩' || coalesce(s.walk_min::text, '?') || '分' end
      into v_current
      from public.shops s left join public.stations st on st.id = s.station_id
     where s.id = p_shop_id;
  else
    select value into v_current from public.shop_fields
     where shop_id = p_shop_id and field_key = p_field_key;
  end if;

  -- 今と同じ内容は送れない（㉓の決まり）
  if v_current is not distinct from btrim(p_proposed) then raise exception 'same_as_current'; end if;

  insert into public.edit_requests
    (shop_id, user_id, type, field_key, current_value, proposed_value, how_known, evidence)
  values (p_shop_id, v_user, 'field', p_field_key, v_current, btrim(p_proposed), p_how_known, p_evidence)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.submit_edit_request(uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_edit_request(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- ㉗-3 シートの中の「どの投稿か」を、確定版のカードの形で出せるように
--   いまは penalties.target が1本の文字列だけなので、
--   お店の名前・いつの投稿か・どうなったか を分けて持てるようにする。
--   どれも空でよく、空のときは今までどおり target をそのまま出す。
-- ---------------------------------------------------------------------
alter table public.penalties add column if not exists target_name text;
alter table public.penalties add column if not exists target_when text;
alter table public.penalties add column if not exists target_state text;

-- ---------------------------------------------------------------------
-- ③-2 カレンダー：同じ日に2店以上のときの「+1」を出せるように、その日の数も返す
-- ---------------------------------------------------------------------
drop function if exists public.my_visit_calendar(date, date);
create or replace function public.my_visit_calendar(p_from date, p_to date)
returns table (visited_on date, shop_id uuid, shop_name text, card_path text, n int)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select v.visited_on, v.shop_id, v.created_at, s.name, s.cover_photo_id
      from public.shop_visits v join public.shops s on s.id = v.shop_id
     where v.user_id = auth.uid()
       and v.visited_on between p_from and p_to
       and s.status <> 'deleted'
  ), counted as (
    select visited_on, count(distinct shop_id)::int as n from mine group by 1
  )
  select distinct on (m.visited_on)
         m.visited_on, m.shop_id, m.name,
         (select ph.card_path from public.shop_photos ph
           where ph.id = m.cover_photo_id and ph.status = 'open'),
         c.n
    from mine m join counted c on c.visited_on = m.visited_on
   order by m.visited_on, m.created_at desc
$$;
revoke all on function public.my_visit_calendar(date, date) from public, anon;
grant execute on function public.my_visit_calendar(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- ③-16 自分のハッシュタグは8つまで（確定版 Final-03-Profile_16 の「5/8」）
-- ---------------------------------------------------------------------
create or replace function public.set_my_tags(p_tag_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  i int := 0;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if array_length(p_tag_ids, 1) > 8 then raise exception 'tag_limit'; end if;
  delete from public.user_tags where user_id = v_user;
  foreach v_id in array coalesce(p_tag_ids, '{}') loop
    insert into public.user_tags (user_id, tag_id, sort) values (v_user, v_id, i)
      on conflict do nothing;
    i := i + 1;
  end loop;
end;
$$;
revoke all on function public.set_my_tags(uuid[]) from public, anon;
grant execute on function public.set_my_tags(uuid[]) to authenticated;
