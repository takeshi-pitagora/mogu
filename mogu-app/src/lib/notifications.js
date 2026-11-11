// =============================================================
// 通知（ベル・一覧）。3回目（グループと通知）：引き渡し書 §7-6
// =============================================================
import { supabase } from './supabase';
import { shopPhotos } from './shop';

export async function listNotifications() {
  const { data, error } = await supabase.rpc('list_notifications');
  if (error) throw error;
  return data || [];
}

export async function unreadCount() {
  const { data, error } = await supabase.rpc('notifications_unread_count');
  if (error) throw error;
  return data || 0;
}

export async function markNotificationsRead(ids) {
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null });
  if (error) throw error;
}

export async function respondGroupInvite(inviteId, accept) {
  const { error } = await supabase.rpc('respond_group_invite', { p_invite_id: inviteId, p_accept: accept });
  if (error) throw error;
}

// マッチの通知の丸い写真（お店の最初の写真）。見つからなければ呼び出し側でロゴに差し替える
export async function fetchRestaurantThumbs(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (list.length === 0) return {};
  const { data, error } = await supabase.from('restaurants').select('*').in('id', list);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => {
    map[r.id] = shopPhotos(r)[0] || null;
  });
  return map;
}

// お知らせの本文（運営からのお知らせをタップしたとき）
export async function fetchAnnouncement(id) {
  const { data, error } = await supabase.from('announcements').select('id, title, body, published_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
