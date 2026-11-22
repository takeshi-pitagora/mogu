-- 点検用のデータ。どの画面にも「中身がある」状態を作る
\set ON_ERROR_STOP on
\set U '88888888-8888-8888-8888-888888888888'
\set F '77777777-7777-7777-7777-777777777777'

insert into auth.users (id, created_at) values (:'U'::uuid, now() - interval '60 days'), (:'F'::uuid, now() - interval '90 days')
  on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name) values
  (:'U'::uuid, 'watchme', '点検ユーザー'), (:'F'::uuid, 'tomodachi', 'ともだち')
  on conflict (id) do nothing;

-- お店を本物の手順で登録する（shops と restaurants の両方に入る）
do $$
declare v_st uuid; v_shop uuid; i int;
  names text[] := array['Enso. 円相 代官山','渋谷DRAエイトマン','347CAFE&LOUNGE','オッティモ・シーフード','人間レストラン 東新宿'];
  areas text[] := array['代官山','渋谷','渋谷','新宿','新宿'];
  genres text[] := array['居酒屋','イタリアン','カフェ','イタリアン','居酒屋'];
begin
  perform set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
  for i in 1..array_length(names, 1) loop
    select id into v_st from public.stations where name = areas[i] limit 1;
    if v_st is null then select id into v_st from public.stations order by id limit 1; end if;
    begin
      v_shop := public.register_shop(
        p_name => names[i], p_station_id => v_st, p_walk_min => 3 + i,
        p_genre_main => genres[i], p_genre_sub => null,
        p_visited_on => current_date - i, p_time_of_day => 'dinner',
        p_budget_bucket => 3 + (i % 4), p_gender => 'male',
        p_highlight_keys => array['taste'], p_highlight_reason => 'おいしい',
        p_photos => format('[{"kind":"food","path":"shops/demo%s.jpg","card_path":"shops/demo%s_card.jpg","width":1200,"height":1200}]', i, i)::jsonb,
        p_fields => '{"hours":"11:00-22:00"}'::jsonb,
        p_tags => array['点検'], p_menu => '[]'::jsonb, p_comment => 'ここがよかった');
    exception when others then
      raise notice 'register_shop % : %', names[i], sqlerrm;
    end;
  end loop;
end $$;

update public.restaurants set area = coalesce(area, '渋谷'), genre = coalesce(genre, 'イタリアン'),
       is_excluded = coalesce(is_excluded, false);
update public.restaurants set photos = '["shops/demo1.jpg","shops/demo2.jpg"]'::jsonb
 where photos is null or jsonb_typeof(photos) <> 'array' or jsonb_array_length(photos) = 0;

-- グループ（新着・ボードに行が出るように）
insert into public.groups (id, name, created_by)
  values ('cccccccc-0000-0000-0000-000000000001', '点検グループ', :'U'::uuid)
  on conflict (id) do nothing;
insert into public.group_members (group_id, user_id) values
  ('cccccccc-0000-0000-0000-000000000001', :'U'::uuid),
  ('cccccccc-0000-0000-0000-000000000001', :'F'::uuid)
  on conflict do nothing;
insert into public.group_shops (group_id, restaurant_id)
  select 'cccccccc-0000-0000-0000-000000000001', r.id from public.restaurants r limit 6
  on conflict do nothing;
insert into public.group_hearts (group_id, restaurant_id, user_id)
  select 'cccccccc-0000-0000-0000-000000000001', gs.restaurant_id, :'U'::uuid
    from public.group_shops gs where gs.group_id = 'cccccccc-0000-0000-0000-000000000001' limit 3
  on conflict do nothing;

-- 保存したお店
insert into public.saved_restaurants (user_id, restaurant_id)
  select :'U'::uuid, r.id from public.restaurants r limit 4
  on conflict do nothing;

-- お知らせ
insert into public.notifications (user_id, type, payload)
  values (:'U'::uuid, 'group_match', '{"group_id":"cccccccc-0000-0000-0000-000000000001","restaurant_name":"点検の店"}'::jsonb);

select (select count(*) from public.shops) as shops,
       (select count(*) from public.restaurants) as restaurants,
       (select count(*) from public.group_shops) as group_shops,
       (select count(*) from public.saved_restaurants) as saved;
