// アカウント削除（App Store ガイドライン 5.1.1(v) 対応）
//
// クライアントは自分のログイントークン（JWT）を付けてこの関数を呼ぶだけ。
// 特権キー（service role）はこの関数の中（サーバー側）にしか存在しない。
//
// 処理の流れ
//   1. JWT から「呼び出した本人」を特定（他人のアカウントは絶対に消せない）
//   2. 本人に紐づくデータを、外部キー制約に引っかからない順序で削除
//        swipes / saved_restaurants / group_members（user_id = 本人）
//        → 本人が作成したグループの invites / group_members / groups
//        → profiles（id = 本人）
//   3. 最後に auth.users から削除（以後ログイン不可）
//
// 他メンバーが参加している「自分が作ったグループ」も削除対象にする。
// （作成者がいなくなったグループが残ると、招待・管理ができなくなるため）

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: '認証情報がありません。' }, 401);

    // ① 本人確認：呼び出し元のJWTで getUser する（service role は使わない）
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: 'ユーザーを確認できませんでした。' }, 401);
    const userId = userData.user.id;

    // ② ここからは RLS を越えて削除するため service role を使う
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 失敗したら「どの段階で」「なぜ」失敗したかが分かるようにする（Supabaseのログで確認できる）
    const step = async (label: string, run: () => Promise<{ error: { message: string } | null }>) => {
      const { error } = await run();
      if (error) throw new Error(`[${label}] ${error.message}`);
    };

    // 本人のスワイプ履歴・保存・グループ参加を削除
    await step('swipes', () => admin.from('swipes').delete().eq('user_id', userId));
    await step('saved_restaurants', () => admin.from('saved_restaurants').delete().eq('user_id', userId));
    await step('group_members(self)', () => admin.from('group_members').delete().eq('user_id', userId));

    // 本人が作成したグループ：招待 → 参加者 → グループ本体 の順に削除
    const { data: owned, error: ownedError } = await admin
      .from('groups').select('id').eq('created_by', userId);
    if (ownedError) throw new Error(`[groups(select)] ${ownedError.message}`);
    const ownedIds = (owned ?? []).map((g: { id: string }) => g.id);
    if (ownedIds.length > 0) {
      await step('invites', () => admin.from('invites').delete().in('group_id', ownedIds));
      await step('group_members(owned)', () => admin.from('group_members').delete().in('group_id', ownedIds));
      await step('groups', () => admin.from('groups').delete().in('id', ownedIds));
    }

    await step('profiles', () => admin.from('profiles').delete().eq('id', userId));

    // ③ 最後に認証ユーザー本体を削除
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw new Error(`[auth.users] ${authDeleteError.message}`);

    return json({ success: true });
  } catch (err) {
    console.error('delete-account 失敗:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
