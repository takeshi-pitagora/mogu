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

export async function leaveGroup({ groupId, userId }) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

// ピン留め・ミュート（3回目 §7-5・Final-11）
export async function setGroupPinned(groupId, pinned) {
  const { error } = await supabase.rpc('set_group_pinned', { p_group_id: groupId, p_pinned: pinned });
  if (!missingFunction(error)) {
    if (error) throw error;
    return;
  }
  const { data } = await supabase.auth.getUser();
  const { error: e2 } = await supabase.from('group_members').update({ pinned }).eq('group_id', groupId).eq('user_id', data.user?.id);
  if (e2) throw e2;
}

export async function setGroupMuted(groupId, muted) {
  const { error } = await supabase.rpc('set_group_muted', { p_group_id: groupId, p_muted: muted });
  if (error && !missingFunction(error)) throw error;
}

export async function renameGroup(groupId, name) {
  const { error } = await supabase.rpc('rename_group', { p_group_id: groupId, p_name: name });
  if (error) throw error;
}

// IDで招待する（見つからない・招待できない、は同じ文言で返す。相手に知られないため）
export async function inviteByHandle(groupId, handle) {
  const { error } = await supabase.rpc('invite_by_handle', { p_group_id: groupId, p_handle: handle });
  if (!error) return { ok: true };
  if (missingFunction(error)) return { error: 'unsupported' };
  if (/not_found/i.test(error.message || '')) return { error: 'notFound' };
  return { error: 'failed' };
}

// IDで招待：送る前に「相手を確かめる」画面用のプレビュー（確定版 ⑪-9。4回目 §3-3）
export async function previewInviteeByHandle(groupId, handle) {
  const { data, error } = await supabase.rpc('preview_invitee_by_handle', { p_group_id: groupId, p_handle: handle });
  if (error) {
    if (missingFunction(error)) return { error: 'unsupported' };
    if (/not_found/i.test(error.message || '')) return { error: 'notFound' };
    return { error: 'failed' };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: 'notFound' };
  return {
    profile: {
      id: row.id,
      displayName: row.display_name,
      handle: row.handle,
      avatarPath: row.avatar_path,
      moguType: row.mogu_type_code
        ? {
            code: row.mogu_type_code,
            characterName: row.mogu_type_character_name,
            nickname: row.mogu_type_nickname,
            linkedAt: row.mogu_type_linked_at,
          }
        : null,
    },
  };
}

// グループのお店のタブ：まだ見ていない流れ（feed）とボード（board・♡の多い順）
export async function fetchGroupFeed(groupId) {
  const { data, error } = await supabase.rpc('get_group_feed', { p_group_id: groupId });
  if (error) {
    if (missingFunction(error)) return [];
    throw error;
  }
  return data || [];
}

export async function fetchGroupBoard(groupId) {
  const { data, error } = await supabase.rpc('get_group_board', { p_group_id: groupId });
  if (error) {
    if (missingFunction(error)) return [];
    throw error;
  }
  return data || [];
}

// ♡をつける・外す（戻り値：付いた(true)／外れた(false)）
export async function toggleGroupHeart(groupId, restaurantId) {
  const { data, error } = await supabase.rpc('toggle_group_heart', { p_group_id: groupId, p_restaurant_id: restaurantId });
  if (error) throw error;
  return !!data;
}

// ホームでグループを選んでいいね・保存したときに、グループのお店へ足す
export async function addGroupShop({ groupId, restaurantId, source = 'swipe' }) {
  const { error } = await supabase.rpc('add_group_shop', { p_group_id: groupId, p_restaurant_id: restaurantId, p_source: source });
  if (error && !missingFunction(error)) throw error;
}

// グループの通報（1回目は今の仕組み：運営の窓口へメール。2回目で通報の表に保存する形に変える）
export function reportGroupByMail({ group, reason, reporterId }) {
  const subject = `【mogu 通報】グループ「${group.name}」`;
  const body = ['以下のグループを通報します。', '', `理由: ${reason}`, `グループ名: ${group.name}`, `グループID: ${group.id}`, `通報者ID: ${reporterId ?? '-'}`, '', '詳しい内容（任意）:', ''].join('\n');
  window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
}
