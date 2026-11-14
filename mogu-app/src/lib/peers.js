// =============================================================
// おすすめ順に使う、同じグループのメンバーの4軸を取り出す
//
// - 友達の取得は、Supabase の関数 get_group_peers()（supabase/migrations/20261030_group_peers.sql）を使う。
//   他人のプロフィールは RLS で直接読めないことがあるため、
//   「同じグループのメンバーの、表示に必要な列だけ」を返す関数を経由する。
// - 関数がまだ無いDBでは、通常のクエリで読める範囲だけ取得する（読めなければ空）。
// =============================================================
import { supabase } from './supabase';

const AXIS_KEYS = ['VT', 'NF', 'BG', 'PL'];

// おすすめ順に使う4軸。Mogu Type 連携の値（mogu_type_axis_values）だけを見る。
//   古い20問の列（food_axes・food_style）はもう読まない（けんとの指示 2026-11-14）。
//   プロフィールや⑥で見せているのは Mogu Type の結果なので、おすすめだけ別の結果で
//   計算していると、見せている結果と中身が合わなくなるため。
//   連携していない人は「軸なし」＝ null（おすすめ順の計算に入れない）。
export function axesFor(axisValues) {
  if (!axisValues) return null;
  if (!AXIS_KEYS.every((k) => Number.isFinite(Number(axisValues[k])))) return null;
  const out = {};
  AXIS_KEYS.forEach((k) => {
    out[k] = Number(axisValues[k]);
  });
  return out;
}

export async function fetchGroupPeers(userId) {
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_group_peers');
  if (!error) return data || [];

  // 関数が未作成のときの予備ルート
  console.warn('get_group_peers が使えないため、通常のクエリで取得します:', error.message);
  const { data: mine } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
  const groupIds = (mine || []).map((r) => r.group_id);
  if (groupIds.length === 0) return [];

  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .in('group_id', groupIds)
    .neq('user_id', userId);
  const ids = [...new Set((members || []).map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar, mogu_type_code, mogu_type_axis_values')
    .in('id', ids);
  return profiles || [];
}

// グループのメンバー全員（自分を含む）のタイプ・4軸を取得する。
// 関数 get_group_member_types（supabase/migrations/20261030b_group_member_types.sql）を使う。
// 関数がまだ無い／読めないときは空配列（＝おすすめ度は自分だけで計算される）。
export async function fetchGroupMembers(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase.rpc('get_group_member_types', { gid: groupId });
  if (error) {
    console.warn('グループメンバーのタイプを取得できませんでした:', error.message);
    return [];
  }
  return data || [];
}
