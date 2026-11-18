-- =====================================================================
-- 第5回 手順5（㉓ 修正依頼・閉店の報告・通報）で使うもの
--   20261118_round5_fix4.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 情報の修正を依頼する（㉓-4〜9）
--   「今の内容」はサーバーが自分で入れる（送る側がいじれないようにする）
--   同じ項目を、ほかの人の依頼で確かめているあいだは出せない
-- ---------------------------------------------------------------------
create or replace function public.submit_edit_request(
  p_shop_id   uuid,
  p_field_key text,
  p_proposed  text,
  p_how_known text default null,
  p_evidence  text default null
)
returns uuid
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

  select value into v_current from public.shop_fields
   where shop_id = p_shop_id and field_key = p_field_key;

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
-- 2. 閉店・移転を報告する（㉓-12・13）
-- ---------------------------------------------------------------------
create or replace function public.submit_closure_report(
  p_shop_id   uuid,
  p_type      text,          -- closed | moved | resting
  p_moved_to  text default null,
  p_how_known text default null,
  p_evidence  text default null
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
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_type not in ('closed', 'moved', 'resting') then raise exception 'type_invalid'; end if;
  if p_moved_to is not null and public.mogu_has_banned(p_moved_to) then raise exception 'banned_word'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;

  insert into public.edit_requests
    (shop_id, user_id, type, proposed_value, how_known, evidence)
  values (p_shop_id, v_user, p_type, nullif(btrim(coalesce(p_moved_to, '')), ''), p_how_known, p_evidence)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.submit_closure_report(uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_closure_report(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. 通報する（㉓-14〜20。お店・写真・タグ・ひとこと）
-- ---------------------------------------------------------------------
create or replace function public.submit_shop_report(
  p_kind    text,            -- shop | photo | tag | comment
  p_shop_id uuid,
  p_target  uuid default null,
  p_reason  text default null,
  p_detail  text default null
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
  if p_kind not in ('shop', 'photo', 'tag', 'comment') then raise exception 'kind_invalid'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'reason_required'; end if;
  if char_length(coalesce(p_detail, '')) > 200 then raise exception 'detail_too_long'; end if;
  if p_kind <> 'shop' and p_target is null then raise exception 'target_required'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;

  insert into public.reports (reporter_id, kind, target_shop_id, target_id, reason, detail, snapshot)
  values (v_user, p_kind, p_shop_id, p_target, p_reason, nullif(btrim(coalesce(p_detail, '')), ''),
          -- あとで消されても運営が確かめられるように、そのときの中身を残す（§10）
          case p_kind
            when 'photo' then (select to_jsonb(x) from (
                   select ph.path, ph.card_path, ph.kind, ph.user_id, pr.display_name
                     from public.shop_photos ph left join public.profiles pr on pr.id = ph.user_id
                    where ph.id = p_target) x)
            when 'comment' then (select to_jsonb(x) from (
                   select sc.body, sc.user_id, pr.display_name
                     from public.shop_comments sc left join public.profiles pr on pr.id = sc.user_id
                    where sc.id = p_target) x)
            when 'tag' then (select to_jsonb(x) from (
                   select t.name from public.tags t where t.id = p_target) x)
            else (select to_jsonb(x) from (
                   select s.name, s.discoverer_id from public.shops s where s.id = p_shop_id) x)
          end)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.submit_shop_report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_shop_report(text, uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. 通報した相手（ブロックの提案に使う。㉓-18）
-- ---------------------------------------------------------------------
create or replace function public.report_target_user(p_kind text, p_target uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case p_kind
    when 'photo' then (select user_id from public.shop_photos where id = p_target)
    when 'comment' then (select user_id from public.shop_comments where id = p_target)
    else null end
$$;
revoke all on function public.report_target_user(text, uuid) from public, anon;
grant execute on function public.report_target_user(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ㉑のプロフィールに「今確かめている項目」を足す
--   （その項目は押せない＝「今確かめているところです」）
-- ---------------------------------------------------------------------
create or replace function public.shop_checking_fields(p_shop_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct field_key), '{}')
    from public.edit_requests
   where shop_id = p_shop_id and field_key is not null and status in ('open', 'checking')
$$;
revoke all on function public.shop_checking_fields(uuid) from public, anon;
grant execute on function public.shop_checking_fields(uuid) to authenticated;

-- =====================================================================
-- 確認（実行すると3行出ます。3つとも「あっています」が正解）
-- =====================================================================
select '修正の依頼' as "確認",
       case when to_regprocedure('public.submit_edit_request(uuid,text,text,text,text)') is not null
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '閉店・移転の報告',
       case when to_regprocedure('public.submit_closure_report(uuid,text,text,text,text)') is not null
            then 'あっています' else 'ちがいます' end
union all
select '通報と、確かめている項目',
       case when to_regprocedure('public.submit_shop_report(text,uuid,uuid,text,text)') is not null
             and to_regprocedure('public.shop_checking_fields(uuid)') is not null
            then 'あっています' else 'ちがいます' end;
