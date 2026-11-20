import { supabase } from './supabase';

// =============================================================
// 第5回 お店（shops 表）
//   お店の登録・検索は supabase の関数だけを使う（アプリから直接 insert しない）
//   Google Places などの外のサービスは使わない（引き渡し書 §5 ⑰・§7）
// =============================================================

export const SHOP_NAME_MAX = 40;

// お店の写真（Storage の shop-photos）→ 表示用URL
export function shopPhotoUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('shop-photos').getPublicUrl(path);
  return data?.publicUrl || null;
}

// お店の名前の決まり（⑰-1）
export function shopNameError(name) {
  const v = String(name ?? '').trim();
  if (v.length === 0) return null; // 空のときは［次へ］が押せないだけ（赤くしない）
  if (v.length > SHOP_NAME_MAX) return `${SHOP_NAME_MAX}字までです`;
  return null;
}

// 「このお店ですか？」を聞く長さになったか（2文字から・⑰-2）
export const SEARCH_MIN = 2;
export function canSearch(name) {
  return String(name ?? '').trim().length >= SEARCH_MIN;
}

// 名前の近い順に最大3件（東京全体。距離は出さない）
export async function searchShopsByName(name, limit = 3) {
  if (!canSearch(name)) return [];
  const { data, error } = await supabase.rpc('search_shops_by_name', {
    p_name: String(name).trim(),
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    stationName: r.station_name,
    walkMin: r.walk_min,
    discovererName: r.discoverer_name,
    discovererAvatarPath: r.discoverer_avatar_path,
    coverPath: r.cover_path,
  }));
}

// 今日あと何店登録できるか（⑰を開いたとき）
export async function fetchShopQuota() {
  const { data, error } = await supabase.rpc('my_shop_quota');
  if (error) throw error;
  const used = Number(data?.used ?? 0);
  const limit = Number(data?.limit ?? 5);
  return { used, limit, left: Math.max(0, limit - used), suspended: !!data?.suspended };
}

// 東京の駅をさがす（⑱-2。漢字でも「よみ」でも当たる。地図・外の検索は使わない）
export async function searchStations(q, limit = 60) {
  const { data, error } = await supabase.rpc('search_stations', {
    p_q: String(q ?? '').trim() || null,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

// ハッシュタグ（⑲）
//   さがす：ひらがな・カタカナ・英字のどれで打っても同じ候補
export async function searchTags(q, limit = 20) {
  const { data, error } = await supabase.rpc('search_tags', { p_q: String(q ?? '').trim(), p_limit: limit });
  if (error) throw error;
  return data || [];
}

// 何も打っていないときの候補（種類ごと・よく使われる順）
export async function suggestTags(perCategory = 8) {
  const { data, error } = await supabase.rpc('suggest_tags', { p_per_category: perCategory });
  if (error) throw error;
  return data || [];
}

// 新しいタグを作る（作った時点でアプリのタグになる）
export async function createTag(name) {
  const { data, error } = await supabase.rpc('create_tag', { p_name: String(name).trim() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('tag_create_failed');
  return row;
}

// 最寄駅と徒歩（⑰-2 の行・㉑）
export function walkLabel(stationName, walkMin) {
  if (!stationName) return null;
  if (walkMin == null) return stationName;
  return `${stationName} 徒歩${walkMin}分`;
}

// ⑳ 登録が終わったときに出すもの（見つけたお店の手帳とコイン）
export async function fetchRegisterResult(shopId, limit = 3) {
  const { data, error } = await supabase.rpc('my_register_result', { p_shop_id: shopId, p_limit: limit });
  if (error) throw error;
  return data;
}

// 下書き（⑱-16・17。1人に1つ。写真は入れない＝端末に残らないため）
export async function loadDraft() {
  const { data, error } = await supabase.from('shop_drafts').select('body, updated_at').maybeSingle();
  if (error) return null;
  return data?.body || null;
}

export async function saveDraft(body) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  await supabase.from('shop_drafts').upsert({ user_id: uid, body, updated_at: new Date().toISOString() });
}

export async function clearDraft() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  await supabase.from('shop_drafts').delete().eq('user_id', uid);
}

// お店を登録する（⑱の最後。中身は supabase の register_shop が確かめる）
export async function registerShop(input) {
  const { data, error } = await supabase.rpc('register_shop', {
    p_name: input.name.trim(),
    p_station_id: input.stationId,
    p_walk_min: input.walkMin,
    p_genre_main: input.genreMain,
    p_genre_sub: input.genreSub || null,
    p_visited_on: input.visitedOn,
    p_time_of_day: input.timeOfDay,
    p_budget_bucket: input.budgetBucket,
    p_gender: input.gender || null,
    p_highlight_keys: input.highlightKeys || [],
    p_highlight_reason: input.highlightReason || null,
    p_photos: input.photos || [],
    p_fields: input.fields || {},
    p_tags: input.tags || [],
    p_menu: input.menu || [],
    p_comment: input.comment || null,
  });
  if (error) throw error;
  return data; // 新しいお店の id
}

// supabase の関数が止めたときの文言（⑱・⑰で出す）
const MESSAGES = {
  not_signed_in: 'ログインしてから登録できます。',
  posting_suspended: 'いまは投稿ができません。お知らせを見てください。',
  daily_shop_limit: '今日登録できる数をこえました。また明日お願いします。',
  name_required: 'お店の名前を入れてください。',
  station_required: '最寄駅と徒歩の分を入れてください。',
  genre_required: 'ジャンルを選んでください。',
  visited_on_invalid: '行った日をもう一度見てください。',
  time_of_day_invalid: 'ランチか夜かを選んでください。',
  budget_invalid: '予算感を選んでください。',
  gender_invalid: '性別をもう一度選んでください。',
  highlight_required: 'イチ押しを選んでください。',
  banned_word: '使えない言葉が入っています。',
  photo_too_small: '写真が小さすぎます。もう少し大きい写真を選んでください。',
  tag_limit: 'ハッシュタグは5つまでです。',
};

export function registerErrorMessage(err) {
  const raw = String(err?.message || '');
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  return key ? MESSAGES[key] : '登録できませんでした。少し待ってもう一度お願いします。';
}

// ③ 自分のハッシュタグ（プロフィール）
export async function fetchUserTags(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.rpc('user_tags_of', { p_user_id: userId });
  if (error) return [];
  return data || [];
}

export async function saveUserTags(tagIds) {
  const { error } = await supabase.rpc('set_my_tags', { p_tag_ids: tagIds });
  if (error) throw error;
}

// ⑤ 予算感の性別（§9-1 の3）。予算を男女別に出すためだけに使う
// ⑱-24 自分の予算感を入れる（昼・夜それぞれ1つ。入れ直すと入れ替わる）
export async function setMyBudget(shopId, timeOfDay, bucket, gender = null) {
  const { data, error } = await supabase.rpc('set_my_budget', {
    p_shop_id: shopId, p_time_of_day: timeOfDay, p_bucket: bucket, p_gender: gender,
  });
  if (error) throw error;
  return data;
}

export async function myBudgetGender() {
  const { data, error } = await supabase.rpc('my_budget_gender');
  if (error) throw error;
  return data || null;
}

export async function setMyBudgetGender(gender) {
  const { error } = await supabase.rpc('set_my_budget_gender', { p_gender: gender });
  if (error) throw error;
}

// ㉒-19 ［＋ 足す］からハッシュタグを付ける（あるタグは＋1、ないものは足す）
export async function attachShopTags(shopId, tagIds) {
  const { error } = await supabase.rpc('add_shop_tags', { p_shop_id: shopId, p_tag_ids: tagIds });
  if (error) throw error;
}

// ㉔-4 人気のタグ（＋1の多い順）
export async function popularTags(limit = 8) {
  const { data, error } = await supabase.rpc('popular_tags', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

// ㉔-10・11 区から選ぶ
export async function stationWards() {
  const { data, error } = await supabase.rpc('station_wards');
  if (error) throw error;
  return data || [];
}

export async function stationsInWard(ward) {
  const { data, error } = await supabase.rpc('stations_in_ward', { p_ward: ward });
  if (error) throw error;
  return data || [];
}

// ㉕-10 近くの駅（歩いて15分ほど）
export async function stationsNear(name, meters = 1200) {
  const { data, error } = await supabase.rpc('stations_near', { p_name: name, p_meters: meters });
  if (error) throw error;
  return data || [];
}
