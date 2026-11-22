-- =====================================================================
-- 第5回 直し20：駅の予測変換が出ないのを直す（⑱-2）
--   これまでは「前から当てる」だけだったので、
--     「谷」   → 渋谷   が出ない
--     「じゅく」→ 新宿   が出ない
--   前から当たるものを上に出しつつ、途中に入っているものも拾うようにする。
--   20261118_round5_fix19.sql のあとに、1回だけ実行してください
-- =====================================================================

create or replace function public.search_stations(p_q text default null, p_limit int default 50)
returns table (id uuid, name text, ward text, line text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select public.mogu_read_key(coalesce(p_q, '')) as k),
  hit as (
    select distinct on (s.name, s.ward)
           s.id, s.name, s.ward, s.line,
           -- 0: 前から当たる／1: 途中に入っている
           case when s.read_key like q.k || '%'
                  or (s.kana_key is not null and s.kana_key like q.k || '%')
                then 0 else 1 end as rank
      from public.stations s, q
     where q.k is null or q.k = ''
        or s.read_key like q.k || '%'
        or (s.kana_key is not null and s.kana_key like q.k || '%')
        or position(q.k in s.read_key) > 0
        or (s.kana_key is not null and position(q.k in s.kana_key) > 0)
     order by s.name, s.ward, s.line
  )
  select hit.id, hit.name, hit.ward, hit.line
    from hit
   order by hit.rank, char_length(hit.name), hit.name, hit.ward
   limit greatest(1, least(p_limit, 200))
$$;

revoke all on function public.search_stations(text, int) from public, anon;
grant execute on function public.search_stations(text, int) to authenticated;

comment on function public.search_stations(text, int) is
  '駅をさがす。前から当たるものを先に、途中に入っているものも出す（⑱-2）';
