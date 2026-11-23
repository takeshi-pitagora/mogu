-- =====================================================================
-- 第5回 直し22：1人だけのグループでは、マッチの通知を出さない
--
--   マッチの判定は「♡の数 >= メンバーの数」。メンバーが自分1人だと、
--   自分がいいねした瞬間に条件を満たして、自分あてに
--   「グループで○○がマッチしました」が届いてしまっていた。
--
--   マッチの印（group_shops.matched_at）はこれまでどおり付ける。
--   ボードの「マッチ」の表示はそのまま出る。
--   通知だけ、メンバーが2人以上のときに出す。
--
--   20261123_round5_stations_all.sql のあとに、1回だけ実行してください
-- =====================================================================

create or replace function public.mogu_check_group_match(p_group_id uuid, p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members int;
  v_hearts int;
  v_matched timestamptz;
  v_name text;
  v_photo text;
  v_group_name text;
begin
  select count(*) into v_members from public.group_members where group_id = p_group_id;
  select count(*) into v_hearts from public.group_hearts where group_id = p_group_id and restaurant_id = p_restaurant_id;
  select matched_at into v_matched from public.group_shops where group_id = p_group_id and restaurant_id = p_restaurant_id;

  if v_matched is null and v_members > 0 and v_hearts >= v_members then
    update public.group_shops set matched_at = now() where group_id = p_group_id and restaurant_id = p_restaurant_id;

    -- 1人だけのグループでは知らせない（自分のいいねが自分に返ってくるだけなので）
    if v_members >= 2 then
      select name, coalesce(photos->>0, photo_food) into v_name, v_photo from public.restaurants where id = p_restaurant_id;
      select name into v_group_name from public.groups where id = p_group_id;
      insert into public.notifications (user_id, type, payload)
      select gm.user_id, 'group_match', jsonb_build_object(
        'group_id', p_group_id, 'group_name', v_group_name,
        'restaurant_id', p_restaurant_id, 'restaurant_name', v_name, 'restaurant_photo', v_photo
      )
      from public.group_members gm
      where gm.group_id = p_group_id;
    end if;
  end if;
end;
$$;

revoke all on function public.mogu_check_group_match(uuid, uuid) from public, anon;
grant execute on function public.mogu_check_group_match(uuid, uuid) to authenticated;

comment on function public.mogu_check_group_match(uuid, uuid) is
  'グループのマッチ判定。1人だけのグループでは通知を出さない（fix22）';
