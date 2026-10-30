// =============================================================
// 相性診断：同じグループにいる友達を取り出して、相性の高い順に並べる
//
// - 友達の取得は、Supabase の関数 get_group_peers()（supabase/migrations/20261030_group_peers.sql）を使う。
//   他人のプロフィールは RLS で直接読めないことがあるため、
//   「同じグループのメンバーの、表示に必要な列だけ」を返す関数を経由する。
// - 関数がまだ無いDBでは、通常のクエリで読める範囲だけ取得する（読めなければ空）。
// =============================================================
import { supabase } from './supabase';
import { getType } from './mogutype';
import { axesFromTypeCode, pairCompatibility } from './recommend';

const AXIS_KEYS = ['VT', 'NF', 'BG', 'PL'];

// 保存済みの4軸スコアがあればそれを、無ければタイプコードから軸の値を作る
export function axesFor(foodAxes, code) {
  if (foodAxes && AXIS_KEYS.every((k) => Number.isFinite(Number(foodAxes[k])))) {
    const out = {};
    AXIS_KEYS.forEach((k) => { out[k] = Number(foodAxes[k]); });
    return out;
  }
  return getType(code) ? axesFromTypeCode(code) : null;
}

// 自分 me（{ foodAxes, foodStyle }）と友達一覧 peers から、相性の高い順のリストを作る。
// 診断していない友達は percent: null で末尾に回す。
export function rankPeers(me, peers) {
  const myAxes = axesFor(me?.foodAxes, me?.foodStyle);
  const rows = (peers || []).map((p) => {
    const type = getType(p.food_style);
    const theirAxes = axesFor(p.food_axes, p.food_style);
    const percent = myAxes && theirAxes ? pairCompatibility(myAxes, theirAxes).total : null;
    return { id: p.id, name: p.display_name || 'ユーザー', avatar: p.avatar, type, percent };
  });
  return rows.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
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
    .select('id, display_name, avatar, food_style, food_axes')
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
