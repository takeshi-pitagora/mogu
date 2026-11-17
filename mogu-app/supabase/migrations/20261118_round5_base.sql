-- =====================================================================
-- 第5回 5-1「登録して見られる」の土台
--   実装引き渡し書（第5回）§6 のとおり。表と列の名前は、今の作り（複数形の英単語）にそろえた
--
-- 決まり（§6 冒頭・§1-3）
--   ・コイン・dig・番付・確定は、アプリから直接書かせない。書くのは security definer の関数だけ
--   ・投稿系の表も、アプリから直接 insert せず、register_shop を通す
--     （その中で上限・使えない言葉・投稿停止を確かめてから書き、同じ処理でコインの台帳にも入れる）
--   ・どの表にも RLS をかける
--   ・§9-1 が未決の値は app_settings に置き、アプリの更新なしで変えられるようにする
--
-- 2026年11月17日の決定により、Google Places への依存はなくす。
-- このファイルは restaurants（Google）を読まず、中身も写さない
--
-- 何回実行しても大丈夫なように書いてある
-- =====================================================================

-- 名前の近い順の検索（⑰-2 の「このお店ですか？」）に使う
create extension if not exists pg_trgm;
-- ここは scripts/gen_kana.py が作った部分（手で直さない）
create or replace function public.mogu_read_key(src text)
returns text
language plpgsql
immutable
as $fn$
declare
  t text := src;
begin
  if t is null then return null; end if;

  -- 1) 半角カタカナの濁点・半濁点を1文字にまとめる（ﾌﾞ → ブ）
  t := replace(t, 'ｶﾞ', 'ガ');
  t := replace(t, 'ｷﾞ', 'ギ');
  t := replace(t, 'ｸﾞ', 'グ');
  t := replace(t, 'ｹﾞ', 'ゲ');
  t := replace(t, 'ｺﾞ', 'ゴ');
  t := replace(t, 'ｻﾞ', 'ザ');
  t := replace(t, 'ｼﾞ', 'ジ');
  t := replace(t, 'ｽﾞ', 'ズ');
  t := replace(t, 'ｾﾞ', 'ゼ');
  t := replace(t, 'ｿﾞ', 'ゾ');
  t := replace(t, 'ﾀﾞ', 'ダ');
  t := replace(t, 'ﾁﾞ', 'ヂ');
  t := replace(t, 'ﾂﾞ', 'ヅ');
  t := replace(t, 'ﾃﾞ', 'デ');
  t := replace(t, 'ﾄﾞ', 'ド');
  t := replace(t, 'ﾊﾞ', 'バ');
  t := replace(t, 'ﾋﾞ', 'ビ');
  t := replace(t, 'ﾌﾞ', 'ブ');
  t := replace(t, 'ﾍﾞ', 'ベ');
  t := replace(t, 'ﾎﾞ', 'ボ');
  t := replace(t, 'ﾊﾟ', 'パ');
  t := replace(t, 'ﾋﾟ', 'ピ');
  t := replace(t, 'ﾌﾟ', 'プ');
  t := replace(t, 'ﾍﾟ', 'ペ');
  t := replace(t, 'ﾎﾟ', 'ポ');
  t := replace(t, 'ｳﾞ', 'ヴ');

  -- 2) 半角カタカナ → 全角カタカナ
  t := translate(t, 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ', 'ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン');

  -- 3) 全角の英数字・記号 → 半角
  t := translate(t, '！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～', '!"#$%&''()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~');

  -- 4) カタカナ → ひらがな（濁点・半濁点はそのまま残す。「ほんだ」と「ぼんだ」を同じにしない）
  t := translate(t, 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ', 'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ');

  -- 5) 小文字にして、空白と記号を取り除く
  --    「ー」「・」「&」も取り除く（タグの決まりでは使えるが、そろえるときは無視する）
  t := lower(t);
  t := regexp_replace(t, '[[:space:]]', '', 'g');
  t := regexp_replace(t, '[^[:alnum:]ぁ-ゖ一-龯々〆ヵヶ]', '', 'g');

  return nullif(t, '');
end;
$fn$;

comment on function public.mogu_read_key(text) is
  '検索と重なりの確認でそろえた値。カタカナ・半角カナ・全角英数をひらがな／半角小文字にし、空白と記号を取り除く（引き渡し書 第5回 §6-7・§9-2 の8）';
-- ---------------------------------------------------------------------
-- 2. 設定（§9-1 が決まるまでの値を、アプリの更新なしで変えられるようにする）
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1,
  values jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into public.app_settings (id, values) values (1, jsonb_build_object(
  -- モグコインの表（引き渡し書 §6-2）
  'coin_register',            10,
  'coin_full_register',        5,
  'coin_photo',                1,
  'coin_cover_chosen',         3,
  'coin_field',                1,
  'coin_menu',                 2,
  'coin_new_tag',              1,
  'coin_visit_stamp',          1,
  'coin_comment',              1,
  'coin_confirm',              1,
  'coin_edit_accepted',        3,
  'coin_saved_10',             5,
  'coin_saved_50',            10,
  'coin_saved_100',           20,
  -- 上限
  'limit_shops_per_day',       5,
  'limit_daily_coin_other',   30,   -- 登録・しっかり登録・保存のボーナス以外の合計
  'limit_photos_per_shop',     5,   -- 1人が1店に足せる写真
  'limit_photos_per_day',     20,
  'limit_menu_per_shop',       3,
  'limit_tags_per_shop_user',  5,   -- 1人が1店に付けられるタグ（＋1は数えない）
  'limit_comment_min_len',    10,
  -- しっかり登録の条件（§6-2）
  'full_register_photos',      3,
  'full_register_fields',      5,
  -- 写真の大きさ（§9-2 の3。短い辺がこれ未満は使えない）
  'photo_min_short_side',    720,
  -- タグの大きさの3段階（§6-7）
  'tag_big_shop_count',       90,
  'tag_mid_shop_count',       50,
  'tag_big_plus_count',       20,
  'tag_mid_plus_count',       10,
  -- dig（§6-4）。n に必要な累計 = dig_factor * n * (n-1)
  'dig_factor',                5,
  -- 新しいアカウントとみなす日数（§6-3）
  'new_account_days',          7,
  'new_account_first_shops',   3
)) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using (true);

create or replace function public.mogu_setting(key text)
returns numeric language sql stable as $$
  select (values ->> key)::numeric from public.app_settings where id = 1
$$;

-- ---------------------------------------------------------------------
-- 3. 運営（§6-12）。RLS の「運営だけ」を書くのに要る
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- アプリからは読めない（運営は Supabase の管理画面で見る）

create or replace function public.mogu_is_admin(u uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = u)
$$;

-- ---------------------------------------------------------------------
-- 4. profiles に足す列（§6-1）
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists show_in_ranking boolean not null default true;
alter table public.profiles add column if not exists posting_suspended_until timestamptz;
alter table public.profiles add column if not exists budget_gender text;        -- male / female / no_answer
alter table public.profiles add column if not exists device_id text;            -- §9-2 の4（identifierForVendor）
alter table public.profiles add column if not exists notif_shop_coin boolean not null default true;

do $$ begin
  alter table public.profiles add constraint profiles_budget_gender_check
    check (budget_gender is null or budget_gender in ('male', 'female', 'no_answer'));
exception when duplicate_object then null; end $$;

create index if not exists profiles_device_idx on public.profiles (device_id) where device_id is not null;

-- 投稿が止められているか（§6-11。アプリのボタンを灰色にするだけにしない）
create or replace function public.mogu_is_suspended(u uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select posting_suspended_until > now() from public.profiles where id = u),
    false
  )
$$;

-- ---------------------------------------------------------------------
-- 5. 駅（§6-9）。国土数値情報から取り込む
-- ---------------------------------------------------------------------
create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  read_key text generated always as (public.mogu_read_key(name)) stored,
  line text,
  ward text,                       -- 区・市
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists stations_read_idx on public.stations (read_key);
create index if not exists stations_ward_idx on public.stations (ward);
alter table public.stations enable row level security;
drop policy if exists stations_read on public.stations;
create policy stations_read on public.stations for select to authenticated using (true);

-- 2点間のおおよその距離（m）。「近くの駅も含める」（§6-9）に使う。
-- 東京の範囲だけなので、緯度1度=111,000m・経度1度=91,000m の近似で足りる
create or replace function public.mogu_station_distance_m(a uuid, b uuid)
returns double precision language sql stable as $$
  select sqrt(
    power((s1.lat - s2.lat) * 111000, 2) +
    power((s1.lng - s2.lng) * 91000, 2)
  )
  from public.stations s1, public.stations s2
  where s1.id = a and s2.id = b
$$;

-- ---------------------------------------------------------------------
-- 6. お店（§6-1）
--    restaurants（Google）とは別の表。中身は写さない
-- ---------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text generated always as (public.mogu_read_key(name)) stored,
  station_id uuid references public.stations(id),
  walk_min int check (walk_min is null or (walk_min between 1 and 60)),
  genre_main text not null,
  genre_sub text,
  discoverer_id uuid references auth.users(id) on delete set null,
  cover_photo_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'open', 'closed', 'moved', 'resting', 'deleted')),
  editable_until timestamptz not null default now() + interval '24 hours',
  external_place_id text,          -- 今は使わない（Google をやめたため）。将来の紐づけ用に残す
  saved_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shops_name_key_idx on public.shops using gin (name_key gin_trgm_ops);
create index if not exists shops_station_idx on public.shops (station_id);
create index if not exists shops_status_idx on public.shops (status);
create index if not exists shops_discoverer_idx on public.shops (discoverer_id);
alter table public.shops enable row level security;

drop policy if exists shops_read on public.shops;
create policy shops_read on public.shops for select to authenticated
  using (status <> 'deleted');

-- ---------------------------------------------------------------------
-- 7. お店にぶら下がる表
-- ---------------------------------------------------------------------
create table if not exists public.shop_fields (
  shop_id uuid not null references public.shops(id) on delete cascade,
  field_key text not null,
  value text not null,
  filled_by uuid references auth.users(id) on delete set null,
  filled_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  confirm_count int not null default 0,
  primary key (shop_id, field_key)
);
alter table public.shop_fields enable row level security;
drop policy if exists shop_fields_read on public.shop_fields;
create policy shop_fields_read on public.shop_fields for select to authenticated using (true);

create table if not exists public.shop_photos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('food', 'drink', 'interior', 'exterior', 'menu')),
  path text not null,              -- Storage の shop-photos の中の場所（大きいほう）
  card_path text,                  -- カード用の小さいほう（§9-2 の3）
  width int not null,
  height int not null,
  plus_count int not null default 0,
  status text not null default 'open' check (status in ('open', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists shop_photos_shop_idx on public.shop_photos (shop_id) where status = 'open';
alter table public.shop_photos enable row level security;
drop policy if exists shop_photos_read on public.shop_photos;
create policy shop_photos_read on public.shop_photos for select to authenticated
  using (status = 'open');

do $$ begin
  alter table public.shops add constraint shops_cover_fk
    foreign key (cover_photo_id) references public.shop_photos(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.shop_menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  price int,
  photo_id uuid references public.shop_photos(id) on delete set null,
  limited_until date,
  created_at timestamptz not null default now()
);
create index if not exists shop_menu_shop_idx on public.shop_menu_items (shop_id);
alter table public.shop_menu_items enable row level security;
drop policy if exists shop_menu_read on public.shop_menu_items;
create policy shop_menu_read on public.shop_menu_items for select to authenticated using (true);

create table if not exists public.shop_highlights (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  highlight_keys text[] not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id),
  constraint shop_highlights_count check (array_length(highlight_keys, 1) between 1 and 2)
);
alter table public.shop_highlights enable row level security;
drop policy if exists shop_highlights_read on public.shop_highlights;
create policy shop_highlights_read on public.shop_highlights for select to authenticated using (true);

-- 予算感（§6-6）。1人1店に昼・夜それぞれ1つ
create table if not exists public.budget_votes (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time_of_day text not null check (time_of_day in ('lunch', 'dinner')),
  bucket int not null check (bucket between 1 and 8),
  gender_at_vote text check (gender_at_vote is null or gender_at_vote in ('male', 'female', 'no_answer')),
  updated_at timestamptz not null default now(),
  primary key (shop_id, user_id, time_of_day)
);
alter table public.budget_votes enable row level security;
drop policy if exists budget_votes_read on public.budget_votes;
create policy budget_votes_read on public.budget_votes for select to authenticated using (true);

-- 来店スタンプ（5-2 で使う。表はここで作る）
create table if not exists public.shop_visits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visited_on date not null,
  stamp_character text not null,   -- 16体から選ばれた4文字のコード
  created_at timestamptz not null default now()
);
create index if not exists shop_visits_user_idx on public.shop_visits (user_id, visited_on desc);
alter table public.shop_visits enable row level security;
drop policy if exists shop_visits_read_own on public.shop_visits;
create policy shop_visits_read_own on public.shop_visits for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.shop_comments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) <= 140),
  status text not null default 'open' check (status in ('open', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists shop_comments_shop_idx on public.shop_comments (shop_id, created_at desc);
alter table public.shop_comments enable row level security;
drop policy if exists shop_comments_read on public.shop_comments;
create policy shop_comments_read on public.shop_comments for select to authenticated
  using (status = 'open');

-- 情報の確認（5-2）
create table if not exists public.shop_confirmations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_key text not null,
  answer text not null check (answer in ('same', 'different')),
  created_at timestamptz not null default now()
);
create index if not exists shop_confirm_idx on public.shop_confirmations (shop_id, user_id, created_at desc);
alter table public.shop_confirmations enable row level security;

-- ---------------------------------------------------------------------
-- 8. ハッシュタグ（§6-7）
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  read_key text generated always as (public.mogu_read_key(name)) stored,
  kind text not null default 'public' check (kind in ('public', 'field', 'notice')),
  aliases text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'merged', 'deleted')),
  merged_into uuid references public.tags(id),
  shop_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tags_name_len check (char_length(name) between 2 and 15)
);
create unique index if not exists tags_read_key_uniq on public.tags (read_key) where status = 'open';
create index if not exists tags_read_idx on public.tags using gin (read_key gin_trgm_ops);
alter table public.tags enable row level security;
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select to authenticated using (status <> 'deleted');

create table if not exists public.shop_tags (
  shop_id uuid not null references public.shops(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  plus_count int not null default 0,
  status text not null default 'open' check (status in ('open', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  primary key (shop_id, tag_id)
);
create index if not exists shop_tags_tag_idx on public.shop_tags (tag_id);
alter table public.shop_tags enable row level security;
drop policy if exists shop_tags_read on public.shop_tags;
create policy shop_tags_read on public.shop_tags for select to authenticated
  using (status = 'open');

create table if not exists public.tag_votes (
  shop_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, tag_id, user_id),
  foreign key (shop_id, tag_id) references public.shop_tags(shop_id, tag_id) on delete cascade
);
alter table public.tag_votes enable row level security;
drop policy if exists tag_votes_read_own on public.tag_votes;
create policy tag_votes_read_own on public.tag_votes for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.photo_votes (
  photo_id uuid not null references public.shop_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);
alter table public.photo_votes enable row level security;
drop policy if exists photo_votes_read_own on public.photo_votes;
create policy photo_votes_read_own on public.photo_votes for select to authenticated
  using (user_id = auth.uid());

-- ③の自分のハッシュタグ（8つまで）
create table if not exists public.user_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  sort int not null default 0,
  primary key (user_id, tag_id)
);
alter table public.user_tags enable row level security;
drop policy if exists user_tags_read on public.user_tags;
create policy user_tags_read on public.user_tags for select to authenticated using (true);
drop policy if exists user_tags_write_own on public.user_tags;
create policy user_tags_write_own on public.user_tags for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 9. 修正依頼・閉店の報告（㉓）
-- ---------------------------------------------------------------------
create table if not exists public.edit_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('field', 'closed', 'moved', 'resting')),
  field_key text,
  current_value text,
  proposed_value text,
  how_known text,
  evidence text,
  status text not null default 'open' check (status in ('open', 'checking', 'accepted', 'rejected')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists edit_requests_shop_idx on public.edit_requests (shop_id, field_key) where status in ('open', 'checking');
alter table public.edit_requests enable row level security;
drop policy if exists edit_requests_read_own on public.edit_requests;
create policy edit_requests_read_own on public.edit_requests for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 10. モグコインと dig（§6-2〜6-5）
--     アプリからは読むだけ。書くのは security definer の関数だけ
-- ---------------------------------------------------------------------
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  shop_id uuid references public.shops(id) on delete set null,
  target_id uuid,
  amount int not null,
  state text not null default 'pending' check (state in ('pending', 'confirmed', 'cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);
create index if not exists coin_ledger_shop_idx on public.coin_ledger (shop_id);
alter table public.coin_ledger enable row level security;
drop policy if exists coin_ledger_read_own on public.coin_ledger;
create policy coin_ledger_read_own on public.coin_ledger for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.user_coin_totals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  confirmed_total int not null default 0,
  pending_total int not null default 0,
  month_total int not null default 0,
  likes_received int not null default 0,
  dig int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.user_coin_totals enable row level security;
drop policy if exists user_coin_totals_read on public.user_coin_totals;
create policy user_coin_totals_read on public.user_coin_totals for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 11. 罰則と問い合わせ（§6-11・㉗）
-- ---------------------------------------------------------------------
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('notice', 'warning', 'suspended', 'banned')),
  reason text not null,
  target text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists penalties_user_idx on public.penalties (user_id, created_at desc);
alter table public.penalties enable row level security;
drop policy if exists penalties_read_own on public.penalties;
create policy penalties_read_own on public.penalties for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  penalty_id uuid references public.penalties(id) on delete set null,
  body text not null check (char_length(body) <= 1000),
  photo text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
alter table public.appeals enable row level security;
drop policy if exists appeals_read_own on public.appeals;
create policy appeals_read_own on public.appeals for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 12. 登録の下書き（⑱-16・17）
--     端末にも持つが、機種変更で消えないようサーバーにも写す
-- ---------------------------------------------------------------------
create table if not exists public.shop_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.shop_drafts enable row level security;
drop policy if exists shop_drafts_own on public.shop_drafts;
create policy shop_drafts_own on public.shop_drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 13. 今ある表を広げる
-- ---------------------------------------------------------------------
-- 通報の対象に、お店・写真・タグ・ひとことを足す（§6-1）
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('user', 'group', 'general', 'shop', 'photo', 'tag', 'comment'));
alter table public.reports add column if not exists target_shop_id uuid references public.shops(id) on delete set null;
alter table public.reports add column if not exists target_id uuid;   -- 写真・タグ・ひとことの id

-- お知らせの種類を足す（㉗）
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'group_match', 'member_joined', 'id_invite', 'announcement',
    'coin_confirmed', 'coin_cancelled', 'saved_bonus',
    'edit_result', 'closed_result', 'shop_grew', 'dig_up', 'important'
  ));

-- ---------------------------------------------------------------------
-- 14. コインを足す（内部用。関数の中からだけ呼ぶ）
-- ---------------------------------------------------------------------
create or replace function public.mogu_add_coin(
  p_user uuid, p_action text, p_amount int,
  p_shop uuid default null, p_target uuid default null, p_capped boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_other int;
  v_cap int := public.mogu_setting('limit_daily_coin_other')::int;
begin
  if p_amount is null or p_amount <= 0 then return; end if;

  -- 「登録」「しっかり登録」「保存のボーナス」以外は、合わせて1日30コインまで（§6-2）
  if p_capped then
    select coalesce(sum(amount), 0) into v_today_other
      from public.coin_ledger
     where user_id = p_user
       and state <> 'cancelled'
       and action not in ('register', 'full_register', 'saved_bonus')
       and created_at >= date_trunc('day', now());
    if v_today_other >= v_cap then return; end if;
    if v_today_other + p_amount > v_cap then
      p_amount := v_cap - v_today_other;
    end if;
  end if;

  insert into public.coin_ledger (user_id, action, shop_id, target_id, amount, state)
  values (p_user, p_action, p_shop, p_target, p_amount, 'pending');

  insert into public.user_coin_totals (user_id, pending_total)
  values (p_user, p_amount)
  on conflict (user_id) do update
    set pending_total = public.user_coin_totals.pending_total + excluded.pending_total,
        updated_at = now();
end;
$$;

revoke all on function public.mogu_add_coin(uuid, text, int, uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 15. お店を登録する（⑰⑱⑲⑳）
--     アプリは直接 insert せず、この関数だけを呼ぶ
-- ---------------------------------------------------------------------
create or replace function public.register_shop(
  p_name            text,
  p_station_id      uuid,
  p_walk_min        int,
  p_genre_main      text,
  p_genre_sub       text,
  p_visited_on      date,
  p_time_of_day     text,
  p_budget_bucket   int,
  p_gender          text,
  p_highlight_keys  text[],
  p_highlight_reason text,
  p_photos          jsonb default '[]'::jsonb,   -- [{path, card_path, kind, width, height}]
  p_fields          jsonb default '{}'::jsonb,   -- {field_key: value}
  p_tags            text[] default '{}',
  p_menu            jsonb default '[]'::jsonb,   -- [{name, price, limited_until}]
  p_comment         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shop uuid;
  v_today_shops int;
  v_limit int := public.mogu_setting('limit_shops_per_day')::int;
  v_min_side int := public.mogu_setting('photo_min_short_side')::int;
  v_photo jsonb;
  v_first_photo uuid := null;
  v_photo_id uuid;
  v_photo_count int := 0;
  v_field record;
  v_field_count int := 0;
  v_tag text;
  v_tag_id uuid;
  v_menu jsonb;
  v_full boolean;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  if public.mogu_is_suspended(v_user) then
    raise exception 'posting_suspended';
  end if;

  -- 1日に登録できるお店の数（§6-2。サーバーで止める。§8-2）
  select count(*) into v_today_shops
    from public.shops
   where discoverer_id = v_user
     and created_at >= date_trunc('day', now());
  if v_today_shops >= v_limit then
    raise exception 'daily_shop_limit';
  end if;

  -- 必須（⑱）
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if p_station_id is null or p_walk_min is null then raise exception 'station_required'; end if;
  if coalesce(trim(p_genre_main), '') = '' then raise exception 'genre_required'; end if;
  if p_visited_on is null or p_visited_on > current_date then raise exception 'visited_on_invalid'; end if;
  if p_time_of_day not in ('lunch', 'dinner') then raise exception 'time_of_day_invalid'; end if;
  if p_budget_bucket is null or p_budget_bucket not between 1 and 8 then raise exception 'budget_invalid'; end if;
  if p_highlight_keys is null or array_length(p_highlight_keys, 1) is null then raise exception 'highlight_required'; end if;
  if jsonb_array_length(p_photos) < 1 then raise exception 'photo_required'; end if;

  -- 使えない言葉（⑬と同じ仕組み。サーバーでも確かめる）
  if public.mogu_has_banned(p_name)
     or public.mogu_has_banned(coalesce(p_highlight_reason, ''))
     or public.mogu_has_banned(coalesce(p_comment, '')) then
    raise exception 'banned_word';
  end if;

  insert into public.shops (
    name, station_id, walk_min, genre_main, genre_sub, discoverer_id, status
  ) values (
    trim(p_name), p_station_id, p_walk_min, p_genre_main, nullif(p_genre_sub, ''), v_user, 'pending'
  ) returning id into v_shop;

  -- 写真
  for v_photo in select * from jsonb_array_elements(p_photos) loop
    if least((v_photo ->> 'width')::int, (v_photo ->> 'height')::int) < v_min_side then
      raise exception 'photo_too_small';
    end if;
    insert into public.shop_photos (shop_id, user_id, kind, path, card_path, width, height)
    values (
      v_shop, v_user, coalesce(v_photo ->> 'kind', 'food'),
      v_photo ->> 'path', v_photo ->> 'card_path',
      (v_photo ->> 'width')::int, (v_photo ->> 'height')::int
    ) returning id into v_photo_id;
    if v_first_photo is null then v_first_photo := v_photo_id; end if;
    v_photo_count := v_photo_count + 1;
  end loop;
  update public.shops set cover_photo_id = v_first_photo where id = v_shop;

  -- イチ押し
  insert into public.shop_highlights (shop_id, user_id, highlight_keys, reason)
  values (v_shop, v_user, p_highlight_keys, nullif(p_highlight_reason, ''));

  -- 予算感（§6-6）。はじめて入れるときだけ性別を覚える
  if p_gender is not null then
    update public.profiles set budget_gender = p_gender
     where id = v_user and budget_gender is null;
  end if;
  insert into public.budget_votes (shop_id, user_id, time_of_day, bucket, gender_at_vote)
  values (v_shop, v_user, p_time_of_day, p_budget_bucket,
          (select budget_gender from public.profiles where id = v_user));

  -- 行った日（③のカレンダーはここと shop_visits を読む）
  insert into public.shop_visits (shop_id, user_id, visited_on, stamp_character)
  values (v_shop, v_user, p_visited_on, 'register')
  on conflict do nothing;

  -- 任意の項目
  for v_field in select key, value from jsonb_each_text(p_fields) loop
    if coalesce(trim(v_field.value), '') = '' then continue; end if;
    if public.mogu_has_banned(v_field.value) then raise exception 'banned_word'; end if;
    insert into public.shop_fields (shop_id, field_key, value, filled_by)
    values (v_shop, v_field.key, v_field.value, v_user)
    on conflict (shop_id, field_key) do nothing;
    v_field_count := v_field_count + 1;
  end loop;

  -- ハッシュタグ（⑲。1人が1店に5つまで）
  if array_length(p_tags, 1) > public.mogu_setting('limit_tags_per_shop_user')::int then
    raise exception 'tag_limit';
  end if;
  foreach v_tag in array coalesce(p_tags, '{}') loop
    if coalesce(trim(v_tag), '') = '' then continue; end if;
    if public.mogu_has_banned(v_tag) then raise exception 'banned_word'; end if;
    select id into v_tag_id from public.tags
     where read_key = public.mogu_read_key(v_tag) and status = 'open';
    if v_tag_id is null then
      insert into public.tags (name, created_by) values (trim(v_tag), v_user)
      returning id into v_tag_id;
      -- 新しいタグ＋1（§6-2。ほかの2人が＋1したら確定）
      perform public.mogu_add_coin(v_user, 'new_tag',
        public.mogu_setting('coin_new_tag')::int, v_shop, v_tag_id);
    end if;
    insert into public.shop_tags (shop_id, tag_id, created_by)
    values (v_shop, v_tag_id, v_user) on conflict do nothing;
    update public.tags set shop_count = shop_count + 1 where id = v_tag_id;
  end loop;

  -- おすすめメニュー
  for v_menu in select * from jsonb_array_elements(p_menu) loop
    if public.mogu_has_banned(coalesce(v_menu ->> 'name', '')) then raise exception 'banned_word'; end if;
    insert into public.shop_menu_items (shop_id, user_id, name, price, limited_until)
    values (v_shop, v_user, v_menu ->> 'name', (v_menu ->> 'price')::int,
            (v_menu ->> 'limited_until')::date);
  end loop;

  -- ひとこと
  if coalesce(trim(p_comment), '') <> '' then
    insert into public.shop_comments (shop_id, user_id, body) values (v_shop, v_user, trim(p_comment));
    if char_length(trim(p_comment)) >= public.mogu_setting('limit_comment_min_len')::int then
      perform public.mogu_add_coin(v_user, 'comment', public.mogu_setting('coin_comment')::int, v_shop);
    end if;
  end if;

  -- コイン（§6-2）。登録は上限の対象外
  perform public.mogu_add_coin(v_user, 'register',
    public.mogu_setting('coin_register')::int, v_shop, null, false);

  -- しっかり登録（写真3枚と任意の項目5つ）
  v_full := v_photo_count >= public.mogu_setting('full_register_photos')::int
        and v_field_count >= public.mogu_setting('full_register_fields')::int;
  if v_full then
    perform public.mogu_add_coin(v_user, 'full_register',
      public.mogu_setting('coin_full_register')::int, v_shop, null, false);
  end if;

  return v_shop;
end;
$$;

revoke all on function public.register_shop(
  text, uuid, int, text, text, date, text, int, text, text[], text, jsonb, jsonb, text[], jsonb, text
) from public, anon;
grant execute on function public.register_shop(
  text, uuid, int, text, text, date, text, int, text, text[], text, jsonb, jsonb, text[], jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------
-- 16. 「このお店ですか？」（⑰-2）
--     名前の近い順に最大3件。距離は使わない（お店の位置を持たないため）
-- ---------------------------------------------------------------------
create or replace function public.search_shops_by_name(p_name text, p_limit int default 3)
returns table (
  id uuid, name text, station_name text, walk_min int,
  discoverer_name text, discoverer_avatar_path text, cover_path text, similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, st.name, s.walk_min,
         p.display_name, p.avatar_path,
         ph.card_path,
         similarity(s.name_key, public.mogu_read_key(p_name)) as sim
    from public.shops s
    left join public.stations st on st.id = s.station_id
    left join public.profiles p on p.id = s.discoverer_id
    left join public.shop_photos ph on ph.id = s.cover_photo_id
   where s.status <> 'deleted'
     and public.mogu_read_key(p_name) is not null
     and s.name_key % public.mogu_read_key(p_name)
   order by sim desc, s.created_at
   limit greatest(1, least(p_limit, 10))
$$;

revoke all on function public.search_shops_by_name(text, int) from public, anon;
grant execute on function public.search_shops_by_name(text, int) to authenticated;

-- =====================================================================
-- 最後に：ちゃんと入ったかの確認（実行すると結果が3行出ます）
--   2行目の「日本語の検索」が false のときは、このデータベースのロケールでは
--   pg_trgm が日本語を扱えません。⑰-2 の「このお店ですか？」が動かないので、
--   けんとに知らせてください（直し方があります）
-- =====================================================================
select '新しい表の数（23 が正解）' as 確認, count(*)::text as 結果
  from pg_tables where schemaname = 'public' and tablename in (
    'app_settings','admin_users','stations','shops','shop_fields','shop_photos',
    'shop_menu_items','shop_highlights','budget_votes','shop_visits','shop_comments',
    'shop_confirmations','tags','shop_tags','tag_votes','photo_votes','user_tags',
    'edit_requests','coin_ledger','user_coin_totals','penalties','appeals','shop_drafts')
union all
select '日本語の検索（true が正解）', (similarity('さんぷる食堂渋谷店','さんぷる食堂') > 0.3)::text
union all
select 'RLS がない新しい表（0 が正解）', count(*)::text
  from pg_tables where schemaname = 'public' and rowsecurity = false
   and tablename in ('shops','shop_photos','coin_ledger','user_coin_totals','penalties','shop_drafts');
