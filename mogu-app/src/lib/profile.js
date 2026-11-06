// プロフィールと安全（2回目）で使う Supabase の関数まわり
//   migrations/20261107_round2.sql の関数と文言を対応させる
import { supabase } from './supabase';

// profiles.avatar_path（Storage の avatars バケットの中の場所）→ 表示用URL
export function photoUrlOf(avatarPath) {
  if (!avatarPath) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
  return data?.publicUrl || null;
}

// 入力中のユーザーIDの確認（check_handle）。status: ok/same/taken/format/reserved/banned/cooldown/rate
export async function checkHandle(handle) {
  const { data, error } = await supabase.rpc('check_handle', { p_handle: handle });
  if (error) return { status: 'error', message: translatePgError(error) };
  return data || { status: 'error' };
}

// 入力中の自己紹介・ニックネーム・グループ名に使えない言葉が含まれていないか（どの言葉かは返らない）
export async function checkText(text) {
  if (!text) return false;
  const { data, error } = await supabase.rpc('check_text', { p_text: text });
  if (error) return false;
  return !!data;
}

export async function markHandlePrompted() {
  await supabase.rpc('mark_handle_prompted');
}

export async function blockUser(userId) {
  const { error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) return { error: translatePgError(error) };
  return { success: true };
}

export async function unblockUser(userId) {
  const { error } = await supabase.rpc('unblock_user', { p_user: userId });
  if (error) return { error: translatePgError(error) };
  return { success: true };
}

export async function listBlocked() {
  const { data, error } = await supabase.rpc('list_blocked');
  if (error) return { error: translatePgError(error) };
  return { data: data || [] };
}

// kind: 'user' | 'group' | 'general'
export async function submitReport({ kind, reason, detail, targetUser, targetGroup, targetHandle, screenshots }) {
  const { data, error } = await supabase.rpc('submit_report', {
    p_kind: kind,
    p_reason: reason,
    p_detail: detail || null,
    p_target_user: targetUser || null,
    p_target_group: targetGroup || null,
    p_target_handle: targetHandle || null,
    p_screenshots: screenshots || [],
  });
  if (error) return { error: translatePgError(error) };
  return { success: true, id: data };
}

// 他の人のプロフィール（同じグループのメンバー＝p_user、IDの完全一致＝p_handle）
export async function getProfileView({ userId, handle } = {}) {
  const { data, error } = await supabase.rpc('get_profile_view', {
    p_user: userId || null,
    p_handle: handle || null,
  });
  if (error) return { error: translatePgError(error) };
  return { data: Array.isArray(data) ? data[0] || null : data };
}

// Supabase の関数が投げるエラー文字（英語のコード）を、画面の言葉に直す
export function translatePgError(error) {
  const msg = String(error?.message || error || '');
  // 2つの端末が同時に同じIDで保存したとき、先に決まった方だけが入り、
  // 後の方は DB の一意制約（profiles_handle_lower_key）で弾かれる。トリガーの handle_taken と同じ文言にする
  if (error?.code === '23505' && /profiles_handle_lower_key/.test(msg)) {
    return 'このIDは使われています';
  }
  const map = [
    [/handle_format/, 'IDは英小文字・数字・_の4〜20文字で、最初は英小文字か数字にしてください'],
    [/handle_reserved/, 'このIDは使えません'],
    [/handle_taken/, 'このIDは使われています'],
    [/handle_cooldown/, 'IDを変えてからまだ2週間たっていません'],
    [/banned_word/, '使えない言葉が含まれています'],
    [/nickname_too_long/, `名前は9文字までです`],
    [/nickname_empty/, '名前を入れてください'],
    [/bio_too_long/, '自己紹介は70文字までです'],
    [/bio_too_many_lines/, '自己紹介の改行は4回までです'],
    [/guest_not_allowed/, 'ゲストアカウントでは使えません'],
    [/group_name_too_long/, 'グループ名は20文字までです'],
    [/group_name_empty/, 'グループ名を入れてください'],
    [/rate_limited|rate/, '少し待ってから、もう一度お試しください'],
    [/not_signed_in/, 'ログインしてください'],
    [/invalid_screenshot|too_many_screenshots|detail_too_long|invalid/, '入力の内容を確認してください'],
    [/Failed to fetch|NetworkError|network/i, '通信できません'],
  ];
  for (const [re, text] of map) {
    if (re.test(msg)) return text;
  }
  return '保存に失敗しました。時間をおいて再度お試しください。';
}
