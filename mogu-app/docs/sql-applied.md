# 本番のデータベースに流したSQL

どれを流したかを見失わないための記録です。流したら、この表の「流した日」を埋めてください。

## 流す順番（大事）

**番号順**に流してください。ファイル名が同じ日付で始まるため、ふつうの名前順だと
`fix1 → fix10 → fix11 … fix19 → fix2 → fix20 → fix3 → fix4 …` の順になり、
`fix15` が `fix4` より先に走って失敗します。Supabase CLI も名前順なので、本番でも同じ事故が起きます。

これから足すものは、日付を変える（例 `20261124_...`）か、`fix-022` のように桁をそろえてください。

## 第5回のぶん

| ファイル | 何をするか | 流した日 |
|---|---|---|
| `20261118_round5_base.sql` 〜 `fix19.sql` | 第5回の本体と直し1〜19 | 済（5-1／5-2／5-3のとき） |
| `20261118_round5_stations.sql` | 駅45件（6エリア） | **流れていなかった**（下の stations_all で入れ直した） |
| `20261122_round5_fix20.sql` | 駅の部分一致。「谷」で渋谷、「じゅく」で新宿が出る | |
| `20261122_round5_fix21.sql` | `get_my_groups` を drop してから作り直す。グループの固定・ミュート・新着件数が効かない件 | |
| `20261123_round5_stations_all.sql` | 東京の主な駅172件。これ1本で入る。何回流しても同じ | 2026-11-22 |
| `20261123_round5_fix22.sql` | 1人だけのグループでマッチの通知を出さない | |

## それぞれの確かめ方

```sql
-- 駅（172 になっていれば入っている）
select count(*) as 駅の数, count(name_kana) as よみ入り, count(lat) as 場所入り from public.stations;

-- fix20（「谷」で3駅くらい出れば効いている。1駅も出なければ未適用）
select name from public.search_stations('谷', 5);

-- fix22（1人グループでいいねしても notifications が増えなければ効いている）

-- fix21（列が10個あれば効いている。5個なら未適用）
select pg_get_function_result(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'get_my_groups';
```

## 気をつけること

- `tools/watch/legacy.sql` は点検用のDBを作るためのものです。**本番には流さないでください。**
- `create temporary table` は Supabase の SQL Editor では使えません（文ごとに接続が切れて消えます）。
  `with ... as (values ...)` で書いてください。
