import { supabase } from './supabase';
import { shopPhotoUrl } from './shops';
import { HIGHLIGHTS, budgetBucketLabel } from './registerForm';
import { ADDRESS_KEY, CLOSED, FREE_TEXT_KEY, HOURS_KEYS, LINK_KEYS, PHONE_KEY, WEEKDAYS } from './shopFields';

// =============================================================
// ㉑ お店のプロフィール
//   5-1 では㉒（2人目以降が足す・来店スタンプ）の入口は出さない
// =============================================================

export const SHOW_GROW = false; // ㉒ができたら true（§8-2）

export async function fetchShopProfile(shopId) {
  const { data, error } = await supabase.rpc('get_shop_profile', { p_shop_id: shopId });
  if (error) throw error;
  return data;
}

export async function toggleSaveShop(shopId) {
  const { data, error } = await supabase.rpc('toggle_save_shop', { p_shop_id: shopId });
  if (error) throw error;
  return data;
}

export async function togglePhotoVote(photoId) {
  const { data, error } = await supabase.rpc('toggle_photo_vote', { p_photo_id: photoId });
  if (error) throw error;
  return data;
}

export async function toggleTagVote(shopId, tagId) {
  const { data, error } = await supabase.rpc('toggle_tag_vote', { p_shop_id: shopId, p_tag_id: tagId });
  if (error) throw error;
  return data;
}

export { shopPhotoUrl };

// ---- 見せ方のきまり（確定版 Final-19 の表） ----
export const TOP_TAGS_ON_PROFILE = 7; // お店のページはみんなのタグの上位7つ
export const TOP_TAGS_ON_CARD = 3; // スワイプ画面は上位3つ

// ＋1の数で3段階（お店のページは20以上で大、10以上で中）
export const PROFILE_TAG_SIZE = { big: 20, mid: 10 };

export function splitTags(tags) {
  const pub = tags.filter((t) => t.kind === 'public');
  return {
    top: pub.slice(0, TOP_TAGS_ON_PROFILE),
    rest: pub.slice(TOP_TAGS_ON_PROFILE),
    notice: tags.filter((t) => t.kind === 'notice'),
    field: tags.filter((t) => t.kind === 'field'),
  };
}

export function highlightLabel(key) {
  return HIGHLIGHTS.find((h) => h.key === key)?.label || key;
}

// 予算感：男女別の「いちばん多い金額」
export function topBudget(budget, timeOfDay, gender) {
  const rows = (budget || []).filter((b) => b.time_of_day === timeOfDay && b.gender === gender);
  if (rows.length === 0) return null;
  const best = rows.reduce((a, b) => (b.count > a.count ? b : a));
  const people = rows.reduce((n, b) => n + b.count, 0);
  return { label: budgetBucketLabel(best.bucket), people };
}

// 金額ごとの人数（㉑-11・⑱の確定）
export function budgetByBucket(budget, timeOfDay) {
  const out = new Map();
  (budget || [])
    .filter((b) => b.time_of_day === timeOfDay)
    .forEach((b) => out.set(b.bucket, (out.get(b.bucket) || 0) + b.count));
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, count]) => ({ bucket, label: budgetBucketLabel(bucket), count }));
}

// ---- ［情報］タブに出す項目の並び（確定版 Final-21 の8） ----
export const INFO_ROWS = [
  { key: '__hours', title: '営業時間・定休日' },
  { key: 'reserve', title: '予約' },
  { key: 'payment', title: '支払い' },
  { key: 'seats', title: '席' },
  { key: 'seat_count', title: '席数の目安' },
  { key: 'party', title: '何人で行くか' },
  { key: 'smoking', title: 'たばこ' },
  { key: 'facility', title: '設備' },
  { key: ADDRESS_KEY, title: '住所' },
  { key: PHONE_KEY, title: '電話' },
  { key: FREE_TEXT_KEY, title: '自由記入' },
];

export function fieldMap(fields) {
  const m = new Map();
  (fields || []).forEach((f) => m.set(f.key, f));
  return m;
}

// 営業時間を7行にまとめる
export function hoursRows(map) {
  return WEEKDAYS.map((w, i) => {
    const f = map.get(HOURS_KEYS[i]);
    return { day: w, value: f?.value || null, closed: f?.value === CLOSED, meta: f || null };
  });
}

export function hasAnyHours(map) {
  return HOURS_KEYS.some((k) => map.has(k));
}

export function linkRows(map) {
  return LINK_KEYS.map((k) => map.get(k)).filter(Boolean);
}

// 「最後に確認：2026年11月・3人 はなこが書きました」（あいだは全角の空白）
export function confirmedLabel(f) {
  if (!f) return null;
  const d = f.last_confirmed_at ? new Date(f.last_confirmed_at) : null;
  const when = d ? `${d.getFullYear()}年${d.getMonth() + 1}月` : null;
  const people = Number(f.confirm_count || 0);
  const parts = [];
  if (when) parts.push(`最後に確認：${when}`);
  if (people > 0) parts.push(`${people}人`);
  const head = parts.join('・');
  return f.filled_by ? `${head}\u3000${f.filled_by}が書きました` : head;
}

export function foundMonth(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月に見つけました`;
}

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function limitedLabel(iso) {
  if (!iso) return null;
  const [, m, d] = String(iso).split('-');
  return `${Number(m)}月${Number(d)}日まで`;
}

// 自分が見つけたお店を直せるのは登録から24時間（§6-1）
export function canEdit(shop) {
  return !!shop?.is_mine && !!shop?.editable_until && new Date(shop.editable_until) > new Date();
}

// 曜日ごとの時間を、同じ時間のまとまりで1行にする
//   例：「火〜木 17:00〜24:00」「金 17:00〜25:00」「定休日：月」
export function hoursText(map) {
  const rows = hoursRows(map);
  if (rows.every((r) => !r.value)) return null;
  const lines = [];
  let run = null;
  rows.forEach((r) => {
    const v = r.closed ? null : r.value;
    if (v && run && run.value === v) {
      run.end = r.day;
    } else {
      if (run) lines.push(run);
      run = v ? { start: r.day, end: r.day, value: v } : null;
    }
  });
  if (run) lines.push(run);
  const closedDays = rows.filter((r) => r.closed).map((r) => r.day);
  const out = lines.map((l) => (l.start === l.end ? `${l.start} ${l.value}` : `${l.start}〜${l.end} ${l.value}`));
  if (closedDays.length > 0) out.push(`定休日：${closedDays.join('・')}`);
  return out.join('\n');
}
