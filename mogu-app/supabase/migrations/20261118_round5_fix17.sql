-- =====================================================================
-- 第5回 fix17：⑱-23〜25 2人目からの予算感
--   お店のページの予算の行から、自分の予算感を入れる（昼・夜それぞれ1つ）。
--   入れ直すと前のものと入れ替わる（引き渡し書 §6-6）。
--   性別は、はじめて入れるときだけ聞く（fix10 の my_budget_gender / set_my_budget_gender）
--   fix16 のあとに実行する
-- =====================================================================

create or replace function public.set_my_budget(
  p_shop_id uuid,
  p_time_of_day text,
  p_bucket int,
  p_gender text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_gender text;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if public.mogu_is_suspended(v_user) then raise exception 'posting_suspended'; end if;
  if p_time_of_day not in ('lunch', 'dinner') then raise exception 'bad_time_of_day'; end if;
  if p_bucket is null or p_bucket < 1 or p_bucket > 8 then raise exception 'bad_bucket'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status <> 'deleted') then
    raise exception 'shop_not_found';
  end if;

  -- はじめて入れるときだけ、性別を覚える（あとから上書きはしない）
  if p_gender is not null then
    update public.profiles set budget_gender = p_gender
     where id = v_user and budget_gender is null;
  end if;
  select budget_gender into v_gender from public.profiles where id = v_user;

  -- 1人1店に昼・夜それぞれ1つ。入れ直すと入れ替わる
  insert into public.budget_votes (shop_id, user_id, time_of_day, bucket, gender_at_vote)
  values (p_shop_id, v_user, p_time_of_day, p_bucket, v_gender)
  on conflict (shop_id, user_id, time_of_day) where user_id is not null do update
    set bucket = excluded.bucket,
        gender_at_vote = excluded.gender_at_vote,
        updated_at = now();

  return jsonb_build_object(
    'time_of_day', p_time_of_day,
    'bucket', p_bucket,
    'gender', v_gender,
    -- 入れたあとの、このお店の予算感（男女別・金額ごとの人数）
    'budget', coalesce((
      select jsonb_agg(jsonb_build_object('time_of_day', b.time_of_day, 'gender', b.gender_at_vote,
                                          'bucket', b.bucket, 'n', b.n))
        from (select time_of_day, gender_at_vote, bucket, count(*) as n
                from public.budget_votes where shop_id = p_shop_id
               group by time_of_day, gender_at_vote, bucket) b
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.set_my_budget(uuid, text, int, text) from public, anon;
grant execute on function public.set_my_budget(uuid, text, int, text) to authenticated;
