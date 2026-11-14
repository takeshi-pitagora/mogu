-- 4回目（修正指示書 第4回）：確定版との差を直す
-- ① get_my_groups の members が古い「food_style」(20問診断)を見ていたのを、
--    Mogu Type 連携の列（mogu_type_code）に直す（⑪のメンバーのラベル用）。
--    戻り値の形（列の数・型）は変えないので DROP FUNCTION は不要。
create or replace function public.get_my_groups()
returns table (
  id uuid, name text, member_count int, members jsonb, created_at timestamptz,
  pinned boolean, muted boolean, last_activity_at timestamptz, unseen_count int, last_event text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id) as member_count,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'display_name', x.display_name, 'mogu_type_code', x.mogu_type_code))
      from (
        select p.id, p.display_name, p.mogu_type_code
        from public.group_members m2
        join public.profiles p on p.id = m2.user_id
        where m2.group_id = g.id
        limit 4
      ) x
    ), '[]'::jsonb) as members,
    g.created_at,
    me.pinned,
    me.muted,
    g.last_activity_at,
    (
      select count(*)::int from public.group_shops gs
      where gs.group_id = g.id
        and not exists (select 1 from public.group_seen s where s.group_id = g.id and s.restaurant_id = gs.restaurant_id and s.user_id = auth.uid())
        and not exists (select 1 from public.group_hearts h where h.group_id = g.id and h.restaurant_id = gs.restaurant_id and h.user_id = auth.uid())
    ) as unseen_count,
    (
      select case
        when count(*) = 0 then null
        when count(*) = 1 then '新しいお店：' || max(r.name)
        else '新しいお店が' || count(*) || '件'
      end
      from public.group_shops gs2
      join public.restaurants r on r.id = gs2.restaurant_id
      where gs2.group_id = g.id and gs2.created_at > now() - interval '7 days'
        and not exists (select 1 from public.group_seen s2 where s2.group_id = g.id and s2.restaurant_id = gs2.restaurant_id and s2.user_id = auth.uid())
    ) as last_event
  from public.groups g
  join public.group_members me on me.group_id = g.id and me.user_id = auth.uid()
  order by me.pinned desc, g.last_activity_at desc;
$$;

revoke all on function public.get_my_groups() from public, anon;
grant execute on function public.get_my_groups() to authenticated;

-- ② IDで招待の「相手を確かめる」画面用：invite_by_handle と同じ条件で、
--   招待できる相手だけプロフィールを返す（できないときは invite_by_handle と同じ not_found）。
--   見つかっても、まだ招待は送らない（送信は今までどおり invite_by_handle で行う）。
create or replace function public.preview_invitee_by_handle(p_group_id uuid, p_handle text)
returns table (
  id uuid, display_name text, handle text, avatar_path text,
  mogu_type_code text, mogu_type_character_name text, mogu_type_nickname text, mogu_type_linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_scope text;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot invite';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  select p.id, p.invite_scope into v_target, v_scope from public.profiles p where lower(p.handle) = lower(trim(p_handle));

  if v_target is null
     or v_target = auth.uid()
     or coalesce(v_scope, 'anyone') <> 'anyone'
     or public.mogu_blocked_between(auth.uid(), v_target)
     or exists (select 1 from public.group_members gm2 where gm2.group_id = p_group_id and gm2.user_id = v_target)
  then
    raise exception 'not_found';
  end if;

  return query
    select p.id, p.display_name, p.handle, p.avatar_path,
           p.mogu_type_code, p.mogu_type_character_name, p.mogu_type_nickname, p.mogu_type_linked_at
    from public.profiles p
    where p.id = v_target;
end;
$$;
revoke all on function public.preview_invitee_by_handle(uuid, text) from public, anon;
grant execute on function public.preview_invitee_by_handle(uuid, text) to authenticated;

-- ③ ⑩お知らせの行の文言・写真に、グループ名・お店の写真・招待した人の名前と写真を使えるよう、
--   通知の payload に足りなかった項目を足す（戻り値は void のまま。DROP不要）
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
end;
$$;

create or replace function public.mogu_notify_member_joined(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_group_name text;
begin
  select display_name, avatar_path into v_name, v_avatar from public.profiles where id = p_user_id;
  select name into v_group_name from public.groups where id = p_group_id;
  insert into public.notifications (user_id, type, payload)
  select gm.user_id, 'member_joined', jsonb_build_object(
    'group_id', p_group_id, 'group_name', v_group_name,
    'user_id', p_user_id, 'display_name', v_name, 'avatar_path', v_avatar
  )
  from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id <> p_user_id;
  perform public.mogu_touch_group(p_group_id);
end;
$$;

create or replace function public.invite_by_handle(p_group_id uuid, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_scope text;
  v_inviter_name text;
  v_inviter_handle text;
  v_inviter_avatar text;
  v_group_name text;
  v_inviter_type text;
  v_inviter_type_name text;
  v_inviter_nickname text;
begin
  if auth.uid() is null then
    raise exception 'guest account cannot invite';
  end if;
  if not exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;

  select id, invite_scope into v_target, v_scope from public.profiles where lower(handle) = lower(trim(p_handle));

  if v_target is null
     or v_target = auth.uid()
     or coalesce(v_scope, 'anyone') <> 'anyone'
     or public.mogu_blocked_between(auth.uid(), v_target)
     or exists (select 1 from public.group_members gm2 where gm2.group_id = p_group_id and gm2.user_id = v_target)
  then
    raise exception 'not_found';
  end if;

  select display_name, handle, avatar_path, mogu_type_code, mogu_type_character_name, mogu_type_nickname
    into v_inviter_name, v_inviter_handle, v_inviter_avatar, v_inviter_type, v_inviter_type_name, v_inviter_nickname
    from public.profiles where id = auth.uid();
  select name into v_group_name from public.groups where id = p_group_id;

  insert into public.group_invites (group_id, inviter_id, invitee_id)
  values (p_group_id, auth.uid(), v_target)
  on conflict do nothing;

  insert into public.notifications (user_id, type, payload)
  values (v_target, 'id_invite', jsonb_build_object(
    'group_id', p_group_id, 'group_name', v_group_name,
    'inviter_id', auth.uid(), 'inviter_name', v_inviter_name, 'inviter_handle', v_inviter_handle, 'inviter_avatar_path', v_inviter_avatar,
    'inviter_mogu_type_code', v_inviter_type, 'inviter_mogu_type_character_name', v_inviter_type_name, 'inviter_mogu_type_nickname', v_inviter_nickname
  ));
end;
$$;
revoke all on function public.mogu_check_group_match(uuid, uuid) from public, anon;
grant execute on function public.mogu_check_group_match(uuid, uuid) to authenticated;
revoke all on function public.mogu_notify_member_joined(uuid, uuid) from public, anon;
grant execute on function public.mogu_notify_member_joined(uuid, uuid) to authenticated;
revoke all on function public.invite_by_handle(uuid, text) from public, anon;
grant execute on function public.invite_by_handle(uuid, text) to authenticated;
