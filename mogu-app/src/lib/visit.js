import { supabase } from './supabase';

// =============================================================
// ㉒ 2人目以降が足す・来店スタンプ
// =============================================================

// ㉒-4〜9 ハリーのアンケート → 来店スタンプ
export async function submitVisitStamp({ shopId, visitedOn, highlights, budgetTime, budgetBucket, comment }) {
  const { data, error } = await supabase.rpc('submit_visit_stamp', {
    p_shop_id: shopId,
    p_visited_on: visitedOn,
    p_highlights: highlights,
    p_budget_time: budgetTime || null,
    p_budget_bucket: budgetBucket ?? null,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data;
}

// ㉒-11 前に押したスタンプ（2回目に行ったとき）
export async function myLastVisit(shopId) {
  const { data, error } = await supabase.rpc('my_last_visit', { p_shop_id: shopId });
  if (error) throw error;
  return data || null;
}

// ㉒-13 ［＋ 足す］の一覧に出す「あと何枚・何品・何項目」
export async function shopAddRoom(shopId) {
  const { data, error } = await supabase.rpc('shop_add_room', { p_shop_id: shopId });
  if (error) throw error;
  return data || null;
}

// ㉒-14・15 写真を足す
export async function addShopPhoto({ shopId, kind, path, cardPath, width, height }) {
  const { data, error } = await supabase.rpc('add_shop_photo', {
    p_shop_id: shopId, p_kind: kind, p_path: path, p_card_path: cardPath, p_width: width, p_height: height,
  });
  if (error) throw error;
  return data;
}

// ㉒-16・17 空いている項目を書く
export async function addShopField({ shopId, fieldKey, value }) {
  const { error } = await supabase.rpc('add_shop_field', {
    p_shop_id: shopId, p_field_key: fieldKey, p_value: value,
  });
  if (error) throw error;
}

// ㉒-18 おすすめメニューを足す
export async function addShopMenuItem({ shopId, name, price, photoId, limitedUntil }) {
  const { data, error } = await supabase.rpc('add_shop_menu_item', {
    p_shop_id: shopId, p_name: name, p_price: price ?? null,
    p_photo_id: photoId || null, p_limited_until: limitedUntil || null,
  });
  if (error) throw error;
  return data;
}

// ㉒-12 2回目からの情報の確認
export async function shopFieldToConfirm(shopId) {
  const { data, error } = await supabase.rpc('shop_field_to_confirm', { p_shop_id: shopId });
  if (error) throw error;
  return data || null;
}

export async function confirmShopField({ shopId, fieldKey, answer }) {
  const { error } = await supabase.rpc('confirm_shop_field', {
    p_shop_id: shopId, p_field_key: fieldKey, p_answer: answer,
  });
  if (error) throw error;
}

// エラーの言いかえ
export function visitError(e) {
  const raw = String(e?.message || '');
  if (raw.includes('posting_suspended')) return 'suspended';
  if (raw.includes('already_stamped')) return 'いま選んだ日は、もうスタンプを押しています';
  if (raw.includes('future_date')) return '先の日は選べません';
  if (raw.includes('banned_word')) return '使えない言葉が含まれています';
  if (raw.includes('photo_too_small')) return 'この写真は小さすぎるため使えません';
  if (raw.includes('photo_shop_limit')) return 'このお店に足せる写真は5枚までです';
  if (raw.includes('photo_day_limit')) return '今日足せる写真は20枚までです';
  if (raw.includes('menu_limit')) return 'このお店に足せるメニューは3品までです';
  if (raw.includes('already_filled')) return 'この項目はもう書かれています';
  if (raw.includes('confirm_too_soon')) return 'この確認は30日に1回です';
  return 'いまは送れませんでした。少し待ってもう一度お願いします。';
}
