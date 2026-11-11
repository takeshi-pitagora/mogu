// =============================================================
// グループのデータ（1回目は今の仕組みのまま：一覧・作る・招待コード・参加・抜ける・通報）
// グループの不具合の修正で足すサーバーの関数（join_group_by_code など）があればそれを使い、
// まだないDBでは今までどおりの読み書きにする
// =============================================================
import { supabase } from './supabase';
import { fetchGroupMembers } from './peers';
import { fetchMyGroups } from './api';
import { buildInviteLink, extractInviteToken, SUPPORT_EMAIL } from './links';

const missingFunction = (error) => !!error && /(function|could not find|does not exist|PGRST202)/i.test(`${error.message || ''} ${error.code || ''}`);

// 参加中のグループ（新しい順）。メンバーの名前つき
export async function listGroups(userId) {
  const groups = await fetchMyGroups(userId);
  // get_my_groups がまだないDB：メンバーはグループごとに読む
  const need = groups.filter((g) => !g.members || g.members.length === 0);
  if (need.length > 0) {
    await Promise.all(
      need.map(async (g) => {
        try {
          const rows = await fetchGroupMembers(g.id);
          g.members = rows.map((m) => ({ id: m.id, display_name: m.display_name, food_style: m.food_style }));
          g.count = rows.length || g.count;
        } catch {
          /* 読めないときは名前なし */
        }
      })
    );
  }
  return groups;
}

export async function groupMembers(groupId) {
  const rows = await fetchGroupMembers(groupId);
  return rows.map((m) => ({ id: m.id, display_name: m.display_name, food_style: m.food_style }));
}

// グループを作る（作った人もメンバーに入る）。目的の選択はなくしたので、今の列の値（friend）を入れる
export async function createGroup({ userId, name }) {
  const { data: group, error } = await supabase.from('groups').insert({ name, purpose: 'friend', created_by: userId }).select().single();
  if (error) throw error;
  const { error: e2 } = await supabase.from('group_members').insert({ group_id: group.id, user_id: userId });
  if (e2) throw e2;
  return { ...group, count: 1, members: [] };
}

// 招待コード（8文字・英大文字と数字。見まちがえやすい 0 O 1 I は使わない）。7日で切れる
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function createInvite(groupId) {
  for (let i = 0; i < 3; i += 1) {
    const token = newCode();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('invites').insert({ group_id: groupId, token, expires_at });
    if (!error) return { code: token, link: buildInviteLink(token) };
    if (!/duplicate|unique/i.test(error.message || '')) throw error;
  }
  throw new Error('招待コードを作れませんでした');
}

// 招待コードの確認（グループ名・人数・メンバー）。サーバーの関数がまだないときは null（確認なしで参加へ進む）
export async function previewInvite(raw) {
  const code = normalizeCode(raw);
  const { data, error } = await supabase.rpc('preview_group_by_code', { p_code: code });
  if (error) {
    if (missingFunction(error)) return null;
    throw error;
  }
  const g = Array.isArray(data) ? data[0] : data;
  if (!g) return { notFound: true };
  return { id: g.id, name: g.name, count: g.member_count, members: g.members || [] };
}

// コードで参加。戻り値 { groupId, name } ／ エラーは { error: 'notFound' | 'expired' | 'guest' | 'failed' }
export async function joinByCode(raw, userId) {
  const code = normalizeCode(raw);
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code });
  if (!error) {
    const g = Array.isArray(data) ? data[0] : data;
    return { groupId: g?.group_id || g?.id || null, name: g?.name || g?.group_name || '' };
  }
  if (!missingFunction(error)) {
    const msg = `${error.message || ''}`;
    if (/not.?found|invalid/i.test(msg)) return { error: 'notFound' };
    if (/expired/i.test(msg)) return { error: 'expired' };
    if (/guest|anonymous/i.test(msg)) return { error: 'guest' };
    return { error: 'failed' };
  }
  // 関数がまだないDB：今までどおり
  const { data: invite, error: e1 } = await supabase.from('invites').select('*').eq('token', code).maybeSingle();
  if (e1) return { error: 'failed' };
  if (!invite) return { error: 'notFound' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'expired' };
  const { error: e2 } = await supabase.from('group_members').upsert({ group_id: invite.group_id, user_id: userId });
  if (e2) return { error: 'failed' };
  return { groupId: invite.group_id, name: '' };
}

const normalizeCode = (raw) => {
  const t = extractInviteToken(raw);
  // 新しい8文字のコードは大文字にそろえる（今までの32文字のコードはそのまま）
  return /^[A-Za-z0-9]{8}$/.test(t) ? t.toUpperCase() : t;
};

// ピン留め・このグループの通知をオフ（確定版 Final-11 の長押しメニュー・設定タブ。3回目）
export async function setGroupPinned(groupId, pinned) {
  const { error } = await supabase.rpc('group_set_pinned', { p_group_id: groupId, p_pinned: pinned });
  if (error) throw error;
}
export async function setGroupMuted(groupId, muted) {
  const { error } = await supabase.rpc('group_set_muted', { p_group_id: groupId, p_muted: muted });
  if (error) throw error;
}

// グループ名を変える（確定版 Final-11 の設定タブ。使えない言葉はサーバーの mogu_groups_guard が弾く）
export async function renameGroup(groupId, name) {
  const { error } = await supabase.from('groups').update({ name }).eq('id', groupId);
  if (error) throw error;
}

// 抜ける（3回目：いちばん早く入った人への引き継ぎをサーバーでまとめて行う）
export async function leaveGroup({ groupId }) {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
  if (error) throw error;
}

// IDで招待（確定版 Final-11「IDで招待」）
export async function findUserByHandle(handle) {
  const { data, error } = await supabase.rpc('find_user_by_handle', { p_handle: handle });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}
export async function inviteByHandle(groupId, handle) {
  const { error } = await supabase.rpc('invite_group_by_handle', { p_group_id: groupId, p_handle: handle });
  if (error) {
    const msg = `${error.message || ''}`;
    if (/user_not_found/i.test(msg)) return { error: 'notFound' };
    if (/already_member/i.test(msg)) return { error: 'alreadyMember' };
    return { error: 'failed' };
  }
  return { success: true };
}

// お店のタブ：流れ（まだ見ていないお店）・ボード・ハートの付け外し（3回目）
export async function groupUnseenShops(groupId) {
  const { data, error } = await supabase.rpc('group_unseen_shops', { p_group_id: groupId });
  if (error) throw error;
  return data || [];
}
export async function groupBoard(groupId) {
  const { data, error } = await supabase.rpc('group_board', { p_group_id: groupId });
  if (error) throw error;
  return data || [];
}

// restaurants の中身まで合わせて返す（流れ・ボードのカードを描くのに使う）
async function withRestaurants(rows, idKey) {
  const ids = [...new Set(rows.map((r) => r[idKey]).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('restaurants').select('*').in('id', ids);
  if (error) throw error;
  const byId = new Map((data || []).map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, shop: byId.get(r[idKey]) || null })).filter((r) => r.shop);
}
export async function groupUnseenShopsFull(groupId) {
  return withRestaurants(await groupUnseenShops(groupId), 'restaurant_id');
}
export async function groupBoardFull(groupId) {
  return withRestaurants(await groupBoard(groupId), 'restaurant_id');
}
export async function groupMarkSeen(groupId, restaurantId) {
  const { error } = await supabase.rpc('group_mark_seen', { p_group_id: groupId, p_restaurant_id: restaurantId });
  if (error) throw error;
}
export async function groupToggleHeart(groupId, restaurantId) {
  const { data, error } = await supabase.rpc('group_toggle_heart', { p_group_id: groupId, p_restaurant_id: restaurantId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || { like_count: 0, my_heart: false, matched: false };
}

// グループの通報（1回目は今の仕組み：運営の窓口へメール。2回目で通報の表に保存する形に変える）
export function reportGroupByMail({ group, reason, reporterId }) {
  const subject = `【mogu 通報】グループ「${group.name}」`;
  const body = ['以下のグループを通報します。', '', `理由: ${reason}`, `グループ名: ${group.name}`, `グループID: ${group.id}`, `通報者ID: ${reporterId ?? '-'}`, '', '詳しい内容（任意）:', ''].join('\n');
  window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
}
