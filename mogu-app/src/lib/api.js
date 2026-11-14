// =============================================================
// ホーム・保存・グループで使うデータの読み書き
// 1回目で足す列（swipes.group_id・swipes.hidden_from_saved・restaurants.photos・restaurants.phone）は
// supabase/migrations/20261106_round1.sql で足す。まだ入っていないDBでも、今までどおり動くようにしてある
// =============================================================
import { supabase } from './supabase';
import { recommend } from './recommend';
import { axesFor, fetchGroupMembers } from './peers';
import { shopGenre } from './shop';
import { addGroupShop } from './groups';

const missingColumn = (error, col) => !!error && new RegExp(col).test(`${error.message || ''} ${error.details || ''}`);

// ---------------------------------------------------------------
// ホームの山札
// filters: { areas: [], genres: [], priceLevel: null }
// ---------------------------------------------------------------
export async function fetchDeck({ user, filters, group }) {
  let swipedIds = [];
  if (user?.id) {
    const { data: swiped, error } = await supabase.from('swipes').select('restaurant_id').eq('user_id', user.id);
    if (error) throw error;
    swipedIds = (swiped || []).map((s) => s.restaurant_id);
  }

  let data;
  if (filters.areas.length > 0) {
    const results = await Promise.all(filters.areas.map((area) => supabase.functions.invoke('places-search', { body: { area } })));
    const merged = new Map();
    results.forEach(({ data: fnData, error: fnError }) => {
      if (fnError) throw fnError;
      (fnData?.restaurants || []).forEach((r) => merged.set(r.id, r));
    });
    data = Array.from(merged.values());
  } else {
    const { data: qData, error } = await supabase.from('restaurants').select('*').eq('is_excluded', false);
    if (error) throw error;
    data = qData || [];
  }

  // 並び順「おすすめ」：ひとりのときは今のアプリの並びのまま。グループのときはメンバーのタイプで並べる（今の仕組み）
  if (filters.sort === 'mogu_type_popular' || filters.sort === 'trending') {
    data = await rankByPopularity(data, filters.sort, user);
  } else if (group?.id && data.length > 0) {
    data = await rankForGroup(data, group.id, user);
  }

  const swiped = new Set(swipedIds);
  let list = data.filter((r) => !swiped.has(r.id) && !r.is_excluded);
  if (filters.genres.length > 0) list = list.filter((r) => filters.genres.includes(shopGenre(r)));
  if (filters.priceLevel != null) list = list.filter((r) => String(r.price_level) === String(filters.priceLevel));
  return list;
}

// 「同じモグタイプに人気」「急上昇中」（3回目 §7-7）：定期的に集計した表から並び順（restaurant_idの配列）をもらう
const missingFn = (error) => !!error && /(function|could not find|does not exist|PGRST20[2-6])/i.test(`${error.message || ''} ${error.code || ''}`);
export async function fetchPopularityOrder(sort, user) {
  if (sort === 'mogu_type_popular') {
    const code = user?.moguType?.code;
    if (!code) return []; // 未診断なら並びは変えない
    const { data, error } = await supabase.rpc('get_popular_restaurant_ids', { p_type: code });
    if (error) {
      if (!missingFn(error)) console.warn('人気の並び順を取得できませんでした:', error.message);
      return [];
    }
    return (data || []).map((r) => (typeof r === 'string' ? r : r.get_popular_restaurant_ids || r.id));
  }
  if (sort === 'trending') {
    const { data, error } = await supabase.rpc('get_trending_restaurant_ids');
    if (error) {
      if (!missingFn(error)) console.warn('急上昇中の並び順を取得できませんでした:', error.message);
      return [];
    }
    return (data || []).map((r) => (typeof r === 'string' ? r : r.get_trending_restaurant_ids || r.id));
  }
  return [];
}

async function rankByPopularity(rows, sort, user) {
  const ids = await fetchPopularityOrder(sort, user);
  if (ids.length === 0) return rows;
  const order = new Map(ids.map((id, i) => [id, i]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ranked = ids.map((id) => byId.get(id)).filter(Boolean);
  const rest = rows.filter((r) => !order.has(r.id));
  return [...ranked, ...rest];
}

// 並び順（restaurant_idの配列）で、すでに取得済みの一覧を並べ替える（保存画面用）
export function applyPopularityOrder(rows, ids) {
  if (!ids || ids.length === 0) return rows;
  const order = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => {
    const oa = order.has(a.id) ? order.get(a.id) : Infinity;
    const ob = order.has(b.id) ? order.get(b.id) : Infinity;
    return oa - ob;
  });
}

async function rankForGroup(rows, groupId, user) {
  const memberRows = await fetchGroupMembers(groupId);
  const others = memberRows.filter((m) => m.id !== user?.id);
  // Mogu Type と連携している人の4軸だけを使う。連携していない人は計算に入れない
  const members = [{ axes: axesFor(user?.moguType?.axisValues) }, ...others.map((m) => ({ axes: axesFor(m.mogu_type_axis_values) }))].filter(
    (m) => m.axes,
  );
  // 全員が未連携なら、今までどおりの並びのまま返す
  if (members.length === 0) return rows;
  const ranked = recommend(members, rows, { limit: rows.length });
  const seen = new Set();
  const ordered = ranked.map(({ restaurant }) => {
    seen.add(restaurant.id);
    return restaurant;
  });
  rows.forEach((r) => {
    if (!seen.has(r.id)) ordered.push(r);
  });
  return ordered;
}

// ---------------------------------------------------------------
// スワイプの記録
// ---------------------------------------------------------------
export async function recordSwipe({ userId, restaurant, action, groupId, moguTypeCode }) {
  if (!userId) return;
  const row = { user_id: userId, restaurant_id: restaurant.id, action };
  if (groupId) row.group_id = groupId;
  if (moguTypeCode) row.mogu_type_code = moguTypeCode;
  let { error } = await supabase.from('swipes').insert(row);
  if (error && groupId && missingColumn(error, 'group_id')) {
    delete row.group_id;
    ({ error } = await supabase.from('swipes').insert(row));
  }
  if (error && moguTypeCode && missingColumn(error, 'mogu_type_code')) {
    delete row.mogu_type_code;
    ({ error } = await supabase.from('swipes').insert(row));
  }
  if (error) throw error;

  // グループで探しているときのいいね：今の仕組み（グループの保存とマッチの記録）をそのまま使う。マッチ！の画面は出さない
  if (action === 'like' && groupId) {
    await supabase
      .from('saved_restaurants')
      .upsert({ user_id: userId, restaurant_id: restaurant.id, group_id: groupId }, { onConflict: 'user_id,restaurant_id,group_id' });
    // グループの「お店」タブ・ボード・マッチ通知（3回目 §7-5）。関数がまだないDBでは何もしない
    await addGroupShop({ groupId, restaurantId: restaurant.id, source: 'swipe' }).catch((err) => console.warn('グループのお店への追加に失敗:', err?.message || err));
  }
}

// ［戻る］：直前のスワイプを取り消す
export async function undoSwipe({ userId, restaurant, action, groupId }) {
  if (!userId) return;
  await supabase.from('swipes').delete().eq('user_id', userId).eq('restaurant_id', restaurant.id);
  if (action === 'like' && groupId) {
    await supabase.from('saved_restaurants').delete().eq('user_id', userId).eq('restaurant_id', restaurant.id).eq('group_id', groupId);
  }
}

// ---------------------------------------------------------------
// 保存（ひとりでいいねしたお店だけ）
// ---------------------------------------------------------------
export async function fetchSaved(userId) {
  const base = () => supabase.from('swipes').select('*, restaurants(*)').eq('user_id', userId).eq('action', 'like');
  let { data, error } = await base().is('group_id', null).eq('hidden_from_saved', false);
  if (error && (missingColumn(error, 'group_id') || missingColumn(error, 'hidden_from_saved'))) {
    ({ data, error } = await base());
  }
  if (error) throw error;
  return (data || [])
    .filter((r) => r.restaurants && !r.restaurants.is_excluded)
    .map((r) => ({ ...r.restaurants, saved_at: r.created_at || null }));
}

export async function setSavedHidden({ userId, restaurantId, hidden }) {
  const { error } = await supabase
    .from('swipes')
    .update({ hidden_from_saved: hidden })
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .eq('action', 'like');
  if (error && missingColumn(error, 'hidden_from_saved')) {
    // 列がまだないDB：今までどおり、いいねの記録を消して外す（元に戻すときは入れ直す）
    if (hidden) {
      const { error: e2 } = await supabase.from('swipes').delete().eq('user_id', userId).eq('restaurant_id', restaurantId).eq('action', 'like');
      if (e2) throw e2;
    } else {
      const { error: e3 } = await supabase.from('swipes').insert({ user_id: userId, restaurant_id: restaurantId, action: 'like' });
      if (e3) throw e3;
    }
    return;
  }
  if (error) throw error;
}

// ホームや詳細の［保存］：ひとりのいいねとして記録する（すでにスワイプ済みなら、いいねに変える）
export async function saveShop({ userId, restaurant }) {
  await supabase.from('swipes').delete().eq('user_id', userId).eq('restaurant_id', restaurant.id);
  const { error } = await supabase.from('swipes').insert({ user_id: userId, restaurant_id: restaurant.id, action: 'like' });
  if (error) throw error;
}

// ---------------------------------------------------------------
// 参加中のグループ（探し方のシート・グループに送る）
// ---------------------------------------------------------------
export async function fetchMyGroups(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.rpc('get_my_groups');
  if (!error && Array.isArray(data)) {
    return data.map((g) => ({
      id: g.id,
      name: g.name,
      count: g.member_count,
      members: g.members || [],
      created_at: g.created_at,
      pinned: !!g.pinned,
      muted: !!g.muted,
      unseenCount: g.unseen_count || 0,
      lastEvent: g.last_event || null,
    }));
  }
  // 関数がまだないDB：今までどおり group_members から読む（メンバーの名前は出せない）
  const { data: rows, error: e2 } = await supabase.from('group_members').select('groups(*)').eq('user_id', userId);
  if (e2) throw e2;
  return (rows || [])
    .map((r) => r.groups)
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((g) => ({ id: g.id, name: g.name, count: null, members: [], created_at: g.created_at, pinned: false, muted: false, unseenCount: 0, lastEvent: null }));
}

// グループに送る（1回目は今の仕組み：送った人のグループの保存に入れる）
export async function sendToGroup({ userId, restaurant, groupId }) {
  const { error } = await supabase
    .from('saved_restaurants')
    .upsert({ user_id: userId, restaurant_id: restaurant.id, group_id: groupId }, { onConflict: 'user_id,restaurant_id,group_id' });
  if (error) throw error;
  await addGroupShop({ groupId, restaurantId: restaurant.id, source: 'send' }).catch((err) => console.warn('グループのお店への追加に失敗:', err?.message || err));
}
