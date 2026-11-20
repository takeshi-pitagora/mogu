-- =====================================================================
-- 第5回 fix16：しっかり登録（＋5）と 保存のボーナス（＋5・＋10・＋20）
--   引き渡し書 §6-2
--     ・しっかり登録：写真3枚と任意の項目5つが「登録から24時間以内」にそろったとき。1店1回
--     ・保存のボーナス：見つけたお店が 10人・50人・100人に保存されたとき。
--       本人と、登録から7日未満のアカウントの保存は数えない。1店で最大＋35
--   どちらも1日30コインの上限の対象外
--   fix15 のあとに実行する
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. しっかり登録。写真や項目があとから足されたときにも呼ぶ
-- ---------------------------------------------------------------------
create or replace function public.mogu_check_full_register(p_shop uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_born timestamptz;
  v_photos int;
  v_fields int;
begin
  select discoverer_id, created_at into v_owner, v_born from public.shops where id = p_shop;
  if v_owner is null then return; end if;
  if v_born < now() - interval '24 hours' then return; end if;        -- 登録から24時間以内だけ
  if exists (select 1 from public.coin_ledger
              where user_id = v_owner and shop_id = p_shop
                and action = 'full_register' and state <> 'cancelled') then
    return;                                                            -- 1店1回
  end if;

  select count(*) into v_photos from public.shop_photos
   where shop_id = p_shop and status <> 'deleted';
  select count(*) into v_fields from public.shop_fields
   where shop_id = p_shop and btrim(value) <> '';

  if v_photos >= public.mogu_setting('full_register_photos')::int
     and v_fields >= public.mogu_setting('full_register_fields')::int then
    perform public.mogu_add_coin(v_owner, 'full_register',
      public.mogu_setting('coin_full_register')::int, p_shop, null, false);
  end if;
end;
$$;
revoke all on function public.mogu_check_full_register(uuid) from public, anon;

-- ---------------------------------------------------------------------
-- 2. 保存のボーナス。数えるのは、本人でも登録7日未満でもない人の保存
-- ---------------------------------------------------------------------
create or replace function public.mogu_check_saved_bonus(p_shop uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_n int;
  v_step int;
  v_amount int;
begin
  select discoverer_id into v_owner from public.shops where id = p_shop;
  if v_owner is null then return; end if;

  select count(*) into v_n
    from public.saved_shops sv
    join auth.users u on u.id = sv.user_id
   where sv.shop_id = p_shop
     and sv.user_id <> v_owner
     and u.created_at <= now() - interval '7 days';

  foreach v_step in array array[10, 50, 100] loop
    if v_n >= v_step
       and not exists (select 1 from public.coin_ledger
                        where user_id = v_owner and shop_id = p_shop
                          and action = 'saved_bonus'
                          and reason = v_step::text and state <> 'cancelled') then
      v_amount := public.mogu_setting('coin_saved_' || v_step)::int;
      insert into public.coin_ledger (user_id, action, shop_id, amount, state, reason)
      values (v_owner, 'saved_bonus', p_shop, v_amount, 'pending', v_step::text);
      insert into public.notifications (user_id, type, payload)
      values (v_owner, 'saved_bonus', jsonb_build_object(
        'shop_id', p_shop,
        'shop_name', (select name from public.shops where id = p_shop),
        'saved_count', v_step,
        'amount', v_amount));
    end if;
  end loop;
end;
$$;
revoke all on function public.mogu_check_saved_bonus(uuid) from public, anon;

-- 「1店で最大＋35」を守れているか確かめやすいよう、同じお店の段は reason に入れている
-- （coin_ledger.reason は取り消しの理由にも使うが、saved_bonus の行では段の数）

-- ---------------------------------------------------------------------
-- 3. 保存したときに、いいね（dig）とボーナスの両方を見る
-- ---------------------------------------------------------------------
create or replace function public.toggle_save_shop(p_shop_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_saved boolean;
  v_owner uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select discoverer_id into v_owner from public.shops where id = p_shop_id;

  if exists (select 1 from public.saved_shops where user_id = v_user and shop_id = p_shop_id) then
    delete from public.saved_shops where user_id = v_user and shop_id = p_shop_id;
    v_saved := false;
  else
    insert into public.saved_shops (user_id, shop_id) values (v_user, p_shop_id)
      on conflict do nothing;
    v_saved := true;
  end if;

  update public.shops s
     set saved_count = (select count(*) from public.saved_shops x where x.shop_id = s.id)
   where s.id = p_shop_id;

  perform public.mogu_bump_likes(v_owner, v_user, case when v_saved then 1 else -1 end);
  if v_saved then
    perform public.mogu_check_saved_bonus(p_shop_id);
  end if;
  return v_saved;
end;
$$;
revoke all on function public.toggle_save_shop(uuid) from public, anon;
grant execute on function public.toggle_save_shop(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. 写真・項目をあとから足したときにも、しっかり登録を見る
-- ---------------------------------------------------------------------
create or replace function public.add_shop_photo(
  p_shop_id uuid, p_kind text, p_path text, p_card_path text, p_width int, p_height int
) returns uuid
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
  if least(p_width, p_height) < public.mogu_setting('photo_min_short_side')::int then
    raise exception 'photo_too_small';
  end if;
  if (select count(*) from public.shop_photos
       where shop_id = p_shop_id and user_id = v_user and status <> 'deleted')
     >= public.mogu_setting('limit_photos_per_shop')::int then
    raise exception 'photo_shop_limit';
  end if;
  if (select count(*) from public.shop_photos
       where user_id = v_user and created_at >= public.mogu_jst_day_start())
     >= public.mogu_setting('limit_photos_per_day')::int then
    raise exception 'photo_day_limit';
  end if;

  insert into public.shop_photos (shop_id, user_id, kind, path, card_path, width, height)
  values (p_shop_id, v_user, p_kind, p_path, p_card_path, p_width, p_height)
  returning id into v_id;

  perform public.mogu_add_coin(v_user, 'photo', public.mogu_setting('coin_photo')::int, p_shop_id, v_id);
  perform public.mogu_check_full_register(p_shop_id);   -- fix16：あとからそろっても「しっかり登録」
  return v_id;
end;
$$;
revoke all on function public.add_shop_photo(uuid, text, text, text, int, int) from public, anon;
grant execute on function public.add_shop_photo(uuid, text, text, text, int, int) to authenticated;

create or replace function public.add_shop_field(
  p_shop_id uuid, p_field_key text, p_value text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_value is null or btrim(p_value) = '' then raise exception 'value_required'; end if;
  if public.mogu_has_banned(p_value) then raise exception 'banned_word'; end if;
  if exists (select 1 from public.shop_fields where shop_id = p_shop_id and field_key = p_field_key) then
    raise exception 'already_filled';
  end if;

  insert into public.shop_fields (shop_id, field_key, value, filled_by)
  values (p_shop_id, p_field_key, btrim(p_value), v_user);

  perform public.mogu_add_coin(v_user, 'field', public.mogu_setting('coin_field')::int, p_shop_id);
  perform public.mogu_check_full_register(p_shop_id);   -- fix16
end;
$$;
revoke all on function public.add_shop_field(uuid, text, text) from public, anon;
grant execute on function public.add_shop_field(uuid, text, text) to authenticated;
