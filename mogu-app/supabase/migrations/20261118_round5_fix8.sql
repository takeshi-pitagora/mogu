-- =====================================================================
-- 第5回 手順7：運営の一覧（§6-12）と、自動で隠す決まり
--   Supabase の管理画面（Table Editor / SQL Editor）だけで回せるように、
--   見るだけの「表（ビュー）」を6つ作ります
--   毎日1回、当番が「通報」から順に見てください
--   20261118_round5_fix7.sql のあとに、1回だけ実行してください
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. タグにも「隠す」の状態を足す（いまは open / merged / deleted だけ）
-- ---------------------------------------------------------------------
alter table public.tags drop constraint if exists tags_status_check;
alter table public.tags add constraint tags_status_check
  check (status in ('open', 'hidden', 'merged', 'deleted'));

-- ---------------------------------------------------------------------
-- 1. 3人から通報された写真・タグ・ひとことは、運営が見るまで自動で隠す
-- ---------------------------------------------------------------------
create or replace function public.mogu_autohide_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if new.target_id is null then return new; end if;
  select count(distinct reporter_id) into v_n
    from public.reports
   where kind = new.kind and target_id = new.target_id and status = 'open';
  if v_n < 3 then return new; end if;

  if new.kind = 'photo' then
    update public.shop_photos set status = 'hidden' where id = new.target_id and status = 'open';
  elsif new.kind = 'comment' then
    update public.shop_comments set status = 'hidden' where id = new.target_id and status = 'open';
  elsif new.kind = 'tag' then
    update public.tags set status = 'hidden' where id = new.target_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_autohide on public.reports;
create trigger reports_autohide after insert on public.reports
  for each row execute function public.mogu_autohide_on_reports();

-- ---------------------------------------------------------------------
-- 2. 2人以上が「閉店」と報告したお店は、運営が見るまでスワイプに出さない
--    （restaurants.is_excluded を立てると、ホームから外れる）
-- ---------------------------------------------------------------------
create or replace function public.mogu_hide_on_closure_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if new.type not in ('closed', 'moved') then return new; end if;
  select count(distinct user_id) into v_n
    from public.edit_requests
   where shop_id = new.shop_id and type in ('closed', 'moved') and status in ('open', 'checking');
  if v_n >= 2 then
    update public.restaurants set is_excluded = true where id = new.shop_id;
  end if;
  return new;
end;
$$;

drop trigger if exists edit_requests_closure_hide on public.edit_requests;
create trigger edit_requests_closure_hide after insert on public.edit_requests
  for each row execute function public.mogu_hide_on_closure_reports();

-- =====================================================================
-- 3. 運営の一覧（§6-12 の6つ）
--    どれも「古いもの・急ぐものが上」に並びます
--    運営だけが見られます（admin_users に入っている人）
-- =====================================================================

-- ① 通報（期限の目安：24時間）
create or replace view public.admin_reports as
select r.created_at as "通報された日時",
       case r.kind when 'shop' then 'お店' when 'photo' then '写真'
                   when 'tag' then 'タグ' when 'comment' then 'ひとこと'
                   when 'user' then 'ユーザー' when 'group' then 'グループ'
                   else r.kind end as "種類",
       r.reason as "理由",
       r.detail as "その他の内容",
       s.name as "お店",
       (select count(distinct x.reporter_id) from public.reports x
         where x.kind = r.kind and x.target_id is not distinct from r.target_id
           and x.status = 'open') as "同じものへの通報の数",
       pr.display_name as "通報した人",
       r.snapshot as "通報したときの中身",
       r.id as "通報のid", r.target_id as "相手のid", r.status as "状態"
  from public.reports r
  left join public.shops s on s.id = r.target_shop_id
  left join public.profiles pr on pr.id = r.reporter_id
 where r.status = 'open'
 order by "同じものへの通報の数" desc, r.created_at;

-- ② 修正依頼（期限の目安：7日。同じ項目に3人なら上に）
create or replace view public.admin_edit_requests as
select e.created_at as "出された日時",
       s.name as "お店",
       e.field_key as "項目",
       e.current_value as "今の内容",
       e.proposed_value as "正しいとされる内容",
       e.how_known as "どうやって知った",
       e.evidence as "写真かリンク",
       (select count(distinct x.user_id) from public.edit_requests x
         where x.shop_id = e.shop_id and x.field_key = e.field_key
           and x.status in ('open', 'checking')) as "同じ項目の依頼の数",
       pr.display_name as "出した人",
       e.id as "依頼のid", e.shop_id as "お店のid", e.status as "状態"
  from public.edit_requests e
  join public.shops s on s.id = e.shop_id
  left join public.profiles pr on pr.id = e.user_id
 where e.type = 'field' and e.status in ('open', 'checking')
 order by "同じ項目の依頼の数" desc, e.created_at;

-- ③ 閉店・移転の報告（期限の目安：7日）
create or replace view public.admin_closure_reports as
select e.created_at as "出された日時",
       s.name as "お店",
       case e.type when 'closed' then '閉店した' when 'moved' then '移転した'
                   else 'しばらく休業中' end as "どうなっていたか",
       e.proposed_value as "移転先",
       e.how_known as "どうやって知った",
       e.evidence as "写真かリンク",
       (select count(distinct x.user_id) from public.edit_requests x
         where x.shop_id = e.shop_id and x.type in ('closed', 'moved')
           and x.status in ('open', 'checking')) as "同じお店の報告の数",
       pr.display_name as "出した人",
       e.id as "報告のid", e.shop_id as "お店のid", e.status as "状態"
  from public.edit_requests e
  join public.shops s on s.id = e.shop_id
  left join public.profiles pr on pr.id = e.user_id
 where e.type in ('closed', 'moved', 'resting') and e.status in ('open', 'checking')
 order by "同じお店の報告の数" desc, e.created_at;

-- ④ 確定待ちのお店（週1回）
--    30日たっても確定しないお店と、新しいアカウントの最初の3店
create or replace view public.admin_pending_shops as
with mine as (
  select id, discoverer_id, name, created_at,
         row_number() over (partition by discoverer_id order by created_at) as no
    from public.shops where status <> 'deleted'
)
select m.created_at as "登録された日時",
       m.name as "お店",
       pr.display_name as "見つけた人",
       m.no as "その人の何店目か",
       case when m.no <= 3 then '新しいアカウントの最初の3店'
            when m.created_at < now() - interval '30 days' then '30日たっても確定しない'
            else 'その他' end as "なぜ一覧に出ているか",
       (select coalesce(sum(c.amount), 0) from public.coin_ledger c
         where c.shop_id = m.id and c.state = 'pending') as "待っているコイン",
       s.saved_count as "保存した人の数",
       m.id as "お店のid"
  from mine m
  join public.shops s on s.id = m.id
  left join public.profiles pr on pr.id = m.discoverer_id
 where exists (select 1 from public.coin_ledger c where c.shop_id = m.id and c.state = 'pending')
   and (m.no <= 3 or m.created_at < now() - interval '30 days')
 order by m.created_at;

-- ⑤ 新しいタグ（週1回。言い換えにまとめる／消す）
create or replace view public.admin_new_tags as
select t.created_at as "作られた日時",
       t.name as "タグ",
       t.shop_count as "付いているお店の数",
       pr.display_name as "作った人",
       (select count(*) from public.reports r
         where r.kind = 'tag' and r.target_id = t.id and r.status = 'open') as "通報の数",
       t.id as "タグのid", t.status as "状態"
  from public.tags t
  left join public.profiles pr on pr.id = t.created_by
 where t.created_by is not null and t.category is null
 order by t.created_at desc;

-- ⑥ 問い合わせ（㉗の「この判断について」。期限の目安：7日）
create or replace view public.admin_appeals as
select a.created_at as "届いた日時",
       pr.display_name as "送った人",
       case p.stage when 'notice' then '注意' when 'warning' then '警告'
                    when 'suspended' then '30日間の投稿停止' when 'banned' then 'アカウント停止'
                    else '（罰則なし）' end as "どの判断について",
       p.reason as "もとの理由",
       a.body as "伝えたいこと",
       a.photo as "写真",
       a.id as "問い合わせのid", a.user_id as "送った人のid", a.status as "状態"
  from public.appeals a
  left join public.profiles pr on pr.id = a.user_id
  left join public.penalties p on p.id = a.penalty_id
 where a.status = 'open'
 order by a.created_at;

-- 運営だけが見られるようにする
do $do$
declare v text;
begin
  foreach v in array array['admin_reports', 'admin_edit_requests', 'admin_closure_reports',
                           'admin_pending_shops', 'admin_new_tags', 'admin_appeals'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    execute format('alter view public.%I set (security_invoker = true)', v);
  end loop;
end
$do$;

-- =====================================================================
-- 確認（実行すると3行出ます。3つとも「あっています」が正解）
-- =====================================================================
select '運営の一覧6つ' as "確認",
       case when (select count(*) from pg_views
                   where schemaname = 'public'
                     and viewname in ('admin_reports', 'admin_edit_requests', 'admin_closure_reports',
                                      'admin_pending_shops', 'admin_new_tags', 'admin_appeals')) = 6
            then 'あっています' else 'ちがいます' end as "結果"
union all
select '3人に通報されたら自動で隠す',
       case when exists (select 1 from pg_trigger where tgname = 'reports_autohide')
            then 'あっています' else 'ちがいます' end
union all
select '閉店の報告が2人でスワイプから外す',
       case when exists (select 1 from pg_trigger where tgname = 'edit_requests_closure_hide')
            then 'あっています' else 'ちがいます' end;
