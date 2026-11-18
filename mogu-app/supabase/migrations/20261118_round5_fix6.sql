-- =====================================================================
-- 第5回 手順6（㉗ 警告・停止と、新しい通知）で使うもの
--   20261118_round5_fix5.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. お知らせの文のための列（段ごとの見出し・起きたこと・これから）
--   運営が文を入れられるようにする。空なら、アプリが決まった文を出す
-- ---------------------------------------------------------------------
alter table public.penalties add column if not exists headline text;
alter table public.penalties add column if not exists happened text;
alter table public.penalties add column if not exists next_text text;

-- 自分の罰則だけ見られる（ほかの人には見せない。㉗の決まり）
alter table public.penalties enable row level security;
drop policy if exists penalties_own_read on public.penalties;
create policy penalties_own_read on public.penalties for select to authenticated
  using (user_id = auth.uid() or public.mogu_is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 2. この判断について問い合わせる（㉗-6・7）
-- ---------------------------------------------------------------------
create or replace function public.submit_appeal(
  p_penalty_id  uuid,
  p_body        text,
  p_photo_paths text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'body_required'; end if;
  if char_length(p_body) > 1000 then raise exception 'body_too_long'; end if;
  -- 自分の罰則にだけ問い合わせできる
  if p_penalty_id is not null
     and not exists (select 1 from public.penalties where id = p_penalty_id and user_id = v_user) then
    raise exception 'penalty_not_found';
  end if;

  insert into public.appeals (user_id, penalty_id, body, photo)
  values (v_user, p_penalty_id, btrim(p_body), nullif((coalesce(p_photo_paths, '{}'))[1], ''))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.submit_appeal(uuid, text, text[]) from public, anon;
grant execute on function public.submit_appeal(uuid, text, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. いま効いている罰則（＋を押したとき・ログインのときに見る）
-- ---------------------------------------------------------------------
create or replace function public.my_active_penalty()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p)
    from public.penalties p
   where p.user_id = auth.uid()
     and (p.stage = 'banned'
          or (p.stage = 'suspended' and (p.ends_at is null or p.ends_at > now())))
   order by p.created_at desc
   limit 1
$$;
revoke all on function public.my_active_penalty() from public, anon;
grant execute on function public.my_active_penalty() to authenticated;

-- ---------------------------------------------------------------------
-- 4. 罰則がついたら、投稿を止める（profiles.posting_suspended_until に写す）
--   ⑰⑱⑲・㉓ の「投稿が止められているか」は、この列を見ている
-- ---------------------------------------------------------------------
create or replace function public.mogu_penalty_applied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage = 'banned' then
    update public.profiles
       set posting_suspended_until = 'infinity'::timestamptz,
           show_in_ranking = false
     where id = new.user_id;
  elsif new.stage = 'suspended' then
    update public.profiles
       set posting_suspended_until = coalesce(new.ends_at, now() + interval '30 days'),
           show_in_ranking = false
     where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists penalties_apply on public.penalties;
create trigger penalties_apply after insert on public.penalties
  for each row execute function public.mogu_penalty_applied();

-- ---------------------------------------------------------------------
-- 5. 通知の設定に「お店とコイン」を足す
--   「運営からの大事なお知らせ」はオフにできない（列を作らない）
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists notif_shop_coin boolean not null default true;

-- =====================================================================
-- 確認（実行すると4行出ます。4つとも「あっています」が正解）
-- =====================================================================
select '問い合わせの関数' as "確認",
       case when to_regprocedure('public.submit_appeal(uuid,text,text[])') is not null
            then 'あっています' else 'ちがいます' end as "結果"
union all
select 'いまの罰則を読む関数',
       case when to_regprocedure('public.my_active_penalty()') is not null
            then 'あっています' else 'ちがいます' end
union all
select '罰則がついたら投稿を止める',
       case when exists (select 1 from pg_trigger where tgname = 'penalties_apply')
            then 'あっています' else 'ちがいます' end
union all
select '通知の設定（お店とコイン）',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'profiles'
                            and column_name = 'notif_shop_coin')
            then 'あっています' else 'ちがいます' end;
