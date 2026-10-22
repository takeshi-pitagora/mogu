-- Mogu Type 診断の4軸スコア（{"VT":0.8,"NF":2.2,"BG":1.0,"PL":2.6}、各0〜3）を保存する列
-- Supabase ダッシュボード → SQL Editor で1回だけ実行する
alter table public.profiles add column if not exists food_axes jsonb;
