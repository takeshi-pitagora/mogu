-- =====================================================================
-- 第5回 fix18：コインの取り消しと、いいねの数からの除外
--   引き渡し書 §6-3「取り消しは、投稿が消されたとき・登録が取り消されたとき・
--   罰則のとき。台帳の行は消さず、state と reason を変える。理由は㉖と㉗で見せる」
--   §6-4「消された写真や、取り消された登録についていたいいねは数から外す」
--   fix17 のあとに実行する
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 台帳の行を取り消す（内部用）。1件ごとにお知らせも出す
-- ---------------------------------------------------------------------
create or replace function public.mogu_cancel_coins(
  p_user uuid,
  p_shop uuid default null,
  p_target uuid default null,
  p_action text default null,
  p_reason text default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_n int := 0;
begin
  for v_row in
    select c.id, c.action, c.amount, c.shop_id, s.name as shop_name
      from public.coin_ledger c
      left join public.shops s on s.id = c.shop_id
     where c.state <> 'cancelled'
       and (p_user is null or c.user_id = p_user)
       and (p_shop is null or c.shop_id = p_shop)
       and (p_target is null or c.target_id = p_target)
       and (p_action is null or c.action = p_action)
  loop
    update public.coin_ledger
       set state = 'cancelled',
           reason = coalesce(p_reason, reason)
     where id = v_row.id;

    insert into public.notifications (user_id, type, payload)
    values (coalesce(p_user, (select user_id from public.coin_ledger where id = v_row.id)), 'coin_cancelled',
            jsonb_build_object('shop_id', v_row.shop_id, 'shop_name', v_row.shop_name,
                               'action', v_row.action, 'amount', v_row.amount,
                               'reason', p_reason));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.mogu_cancel_coins(uuid, uuid, uuid, text, text) from public, anon;

-- ---------------------------------------------------------------------
-- 2. 写真が消されたとき：その写真のコインを取り消し、＋1の分を dig から外す
-- ---------------------------------------------------------------------
create or replace function public.mogu_photo_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_votes int;
begin
  if new.status = 'deleted' and coalesce(old.status, '') <> 'deleted' then
    perform public.mogu_cancel_coins(new.user_id, new.shop_id, new.id, 'photo', '写真が消されたため');
    -- その写真にもらっていた＋1を、いいねの数から外す（§6-4）
    select count(*) into v_votes from public.photo_votes where photo_id = new.id and user_id <> new.user_id;
    if v_votes > 0 then
      perform public.mogu_bump_likes(new.user_id, null, -v_votes);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists shop_photos_deleted on public.shop_photos;
create trigger shop_photos_deleted after update of status on public.shop_photos
  for each row execute function public.mogu_photo_deleted();

-- ---------------------------------------------------------------------
-- 3. 登録が取り消されたとき（お店が消されたとき）：
--    そのお店でその人が得たコインを取り消し、保存でもらっていたいいねも外す
--    閉店（status = 'closed'）では取り消さない（§6-3 の最後）
-- ---------------------------------------------------------------------
create or replace function public.mogu_shop_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saves int;
begin
  if new.status = 'deleted' and coalesce(old.status, '') <> 'deleted' then
    perform public.mogu_cancel_coins(new.discoverer_id, new.id, null, null, '登録が取り消されたため');
    select count(*) into v_saves
      from public.saved_shops sv
      join auth.users u on u.id = sv.user_id
     where sv.shop_id = new.id
       and sv.user_id <> new.discoverer_id
       and u.created_at <= now() - interval '7 days';
    if v_saves > 0 then
      perform public.mogu_bump_likes(new.discoverer_id, null, -v_saves);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists shops_deleted on public.shops;
create trigger shops_deleted after update of status on public.shops
  for each row execute function public.mogu_shop_deleted();

-- ---------------------------------------------------------------------
-- 4. 罰則のとき：そのお知らせで名ざしされた投稿のコインを取り消す
--    penalties.target_id（写真・タグ・ひとことの id）があるときだけ
-- ---------------------------------------------------------------------
alter table public.penalties add column if not exists target_id uuid;
alter table public.penalties add column if not exists target_shop_id uuid;

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

  -- 罰則でその投稿のコインを取り消す（㉗の「仮の1コインは取り消しました」）
  if new.target_id is not null or new.target_shop_id is not null then
    perform public.mogu_cancel_coins(new.user_id, new.target_shop_id, new.target_id, null,
                                     coalesce(new.reason, '運営の判断により取り消しました'));
  end if;
  return new;
end;
$$;

drop trigger if exists penalties_apply on public.penalties;
create trigger penalties_apply after insert on public.penalties
  for each row execute function public.mogu_penalty_applied();
