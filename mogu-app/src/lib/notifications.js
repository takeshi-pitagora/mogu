// =============================================================
// 通知（お知らせ）のデータの読み書き。3回目 §7-6
//   マッチ・メンバー参加・IDでの招待・運営のお知らせ の4種類
//   サーバーの関数がまだないDBでは、通知は出さない（0件のまま）
// =============================================================
import { supabase } from './supabase';

const missingFunction = (error) => !!error && /(function|could not find|does not exist|PGRST20[2-6])/i.test(`${error.message || ''} ${error.code || ''}`);

// お知らせ一覧（通知 + 運営のお知らせを1つの並びに混ぜて、新しい順で返す）
export async function fetchNotifications() {
  const [{ data: notifs, error: e1 }, { data: ann, error: e2 }] = await Promise.all([
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(20),
  ]);
  if (e1 && !missingFunction(e1)) throw e1;

  // IDでの招待は、まだ返事していない（group_invites.status='pending'）ものだけ「返事待ち」に出す
  const inviteNotifIds = (notifs || []).filter((n) => n.type === 'id_invite' && n.payload?.group_id).map((n) => n.payload.group_id);
  let stillPendingGroupIds = new Set();
  if (inviteNotifIds.length > 0) {
    const { data: invites } = await supabase.from('group_invites').select('group_id').eq('status', 'pending').in('group_id', inviteNotifIds);
    stillPendingGroupIds = new Set((invites || []).map((i) => i.group_id));
  }

  const list = [];
  (notifs || []).forEach((n) => {
    const payload = { ...(n.payload || {}) };
    if (n.type === 'id_invite') payload.responded = !stillPendingGroupIds.has(payload.group_id);
    list.push({ id: `n-${n.id}`, rawId: n.id, kind: 'notification', type: n.type, payload, read: !!n.read_at, createdAt: n.created_at });
  });
  if (!e2) {
    (ann || []).forEach((a) => {
      list.push({ id: `a-${a.id}`, rawId: a.id, kind: 'announcement', type: 'announcement', payload: { title: a.title, body: a.body }, read: true, createdAt: a.published_at });
    });
  }
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

// 未読の件数（タブ・ベルの赤い点に使う。運営のお知らせは件数に含めない）
export async function fetchUnreadCount() {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) {
    if (missingFunction(error)) return 0;
    return 0;
  }
  return count || 0;
}

export async function markNotificationsRead(ids) {
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids && ids.length > 0 ? ids : null });
  if (error && !missingFunction(error)) throw error;
}

// 招待（返事待ち）に、受諾／辞退で答える
export async function respondInvite(inviteId, accept) {
  const { data, error } = await supabase.rpc('respond_group_invite', { p_invite_id: inviteId, p_accept: accept });
  if (error) throw error;
  const g = Array.isArray(data) ? data[0] : data;
  return { groupId: g?.group_id || g?.id || null, name: g?.name || '' };
}

// 通知の設定（profiles の notif_* 列）
export async function fetchNotifPrefs() {
  const { data, error } = await supabase
    .from('profiles')
    .select('notif_master, notif_match, notif_member_joined, notif_id_invite, notif_announcement, notif_prompted_at')
    .single();
  if (error) {
    if (missingFunction(error)) return { notif_master: true, notif_match: true, notif_member_joined: true, notif_id_invite: true, notif_announcement: false };
    throw error;
  }
  return data;
}

export async function updateNotifPrefs(patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}

// グループごとのミュート（確定版 Final-11・§7-5）
export async function setGroupMuted(groupId, muted) {
  const { error } = await supabase.rpc('set_group_muted', { p_group_id: groupId, p_muted: muted });
  if (error && !missingFunction(error)) throw error;
}

// 「通知を許可してください」のお願いを出したことを記録する（1度しか出さない）
export async function markNotifPrompted() {
  const { error } = await supabase.rpc('mark_notif_prompted');
  if (error && !missingFunction(error)) console.warn('notif_prompted_at の記録に失敗:', error.message);
}

// 通知の中身を、お知らせ画面に出す文言に変える（確定版 Final-10 の行の文言。修正指示書 §3-6）
//   名前・グループ名・店名だけを太字にするため、文を細かく分けて返す
//   [{ t: '文字', b: true }, …]（b が true のところだけ太字）
export function notificationText(n) {
  const p = n.payload || {};
  const group = p.group_name || 'グループ';
  switch (n.type) {
    // 「代官山ランチ部で、サンプル食堂 渋谷店がマッチしました」
    case 'group_match':
      return [
        { t: group, b: true },
        { t: 'で、' },
        { t: p.restaurant_name || 'お店', b: true },
        { t: 'がマッチしました' },
      ];
    // 「はなこさんが代官山ランチ部に参加しました」
    case 'member_joined':
      return [
        { t: p.display_name || '新しいメンバー', b: true },
        { t: 'さんが' },
        { t: group, b: true },
        { t: 'に参加しました' },
      ];
    // 「@hanako さんから、恵比寿スイーツ会への招待」。返事をしたあとは「恵比寿スイーツ会に参加しました」（⑩-8）
    case 'id_invite':
      if (p.accepted) return [{ t: group, b: true }, { t: 'に参加しました' }];
      return [
        { t: p.inviter_handle ? `@${p.inviter_handle}` : p.inviter_name || '友達', b: true },
        { t: ' さんから、' },
        { t: group, b: true },
        { t: 'への招待' },
      ];
    case 'announcement':
      return [{ t: p.title || 'お知らせ', b: true }];
    default:
      return [{ t: 'お知らせ' }];
  }
}
