# 3つの監視役（全ページの自動点検）

ボタンを押しても何も起きない、写真が出ない、といった不具合を、人が触る前に見つけるための仕組みです。
**本物のSQL**（supabase/migrations をぜんぶ当てたDB）につないで、**本物の画面**を開いて点検します。
作り物の返事で済ませないので、「DBは `photo` を返すのに画面は `photos` を見ていた」ような食い違いも捕まります。

## 3つの監視役

| 役 | 何を見るか |
|---|---|
| ① エラー番 | 画面を開いたときの JS エラー・落ち・`unhandledrejection`・`console.error` |
| ② ボタン番 | 押せるものを全部押して、画面が変わるか。変わらないものを「反応なし」として挙げる |
| ③ 中身番 | 写真が出ていない／`undefined`・`NaN` が出ている／名前のないボタン／小さすぎるボタン |

②は「いま開いているタブ」「外部リンク・メール」「すでに選ばれているもの」は数えません（押しても変わらないのが正しいため）。

## 使い方

```bash
# 1. Postgres を起こす
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main \
  -o '-p 5433 -k /tmp/pgsock -c config_file=/etc/postgresql/16/main/postgresql.conf' -l /tmp/pg.log start"

# 2. 点検用DBを作る（スタブ → legacy.sql → migrations を「番号順」に）
#    ※ ls の名前順ではなく sort -V（番号順）で流すこと。理由は下の「気をつけること」
psql -h 127.0.0.1 -p 5433 -U postgres -c "create database mogu_watch"
psql ... -d mogu_watch -f legacy.sql
for f in $(ls supabase/migrations/*.sql | sort -V); do psql ... -d mogu_watch -f "$f"; done
psql ... -d mogu_watch -f seed.sql

# 3. Supabase のふりをするブリッジを上げる
WATCH_DB=mogu_watch node tools/watch/pgrest.js &

# 4. 点検用にビルド（AuthContext だけ差し替え、ほかは本物のコード）
VITE_SUPABASE_URL=http://127.0.0.1:54330 VITE_SUPABASE_ANON_KEY=dummy \
  npx vite build --config vite.watch.config.mjs

# 5. 走らせる
node tools/watch/run.js      # → tools/watch/report.json と shot_*.png
```

## 気をつけること

- **マイグレーションは番号順（`sort -V`）で流す。** ファイル名が同じ日付で始まるため、ふつうの名前順だと
  `fix1 → fix10 → … → fix19 → fix2 → fix20 → fix3 …` の順になり、`fix15` が `fix4` より先に走って壊れます。
  Supabase CLI も名前順なので、本番でも同じ事故が起きえます。これから足すものは `fix22` ではなく
  日付を変える（例 `20261123_...`）か、`fix-022` のように桁をそろえてください。
- `legacy.sql` は、リポジトリのマイグレーションより前からある表（`groups` `swipes` など）を点検用に作るものです。
  **本番には流さないでください。**
- 画像は Storage から出るので、このブリッジでは出ません。「写真が読めなかった」は点検の都合であって不具合ではありません。
