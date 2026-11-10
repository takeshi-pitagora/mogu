// =============================================================
// お店の表示に使う値（ホームのカード・保存・お店の詳細で共通）
// 元のデータは restaurants 表（Google Places API (New) の Text Search）
// =============================================================

// 写真：新しい photos 列（最大10枚）があればそれを、なければ今までの3枚
export function shopPhotos(row) {
  if (!row) return [];
  const list = Array.isArray(row.photos) ? row.photos.filter(Boolean) : [];
  if (list.length > 0) return list;
  return [row.photo_food, row.photo_interior, row.photo_exterior].filter(Boolean);
}

// 予算（確定版の表記：〜¥1,000／¥1,000〜¥3,000／¥3,000〜¥5,000／¥5,000〜）
export const BUDGETS = [
  { value: 1, label: '〜¥1,000' },
  { value: 2, label: '¥1,000〜¥3,000' },
  { value: 3, label: '¥3,000〜¥5,000' },
  { value: 4, label: '¥5,000〜' },
];
export function budgetLabel(level) {
  return BUDGETS.find((b) => b.value === Number(level))?.label || null;
}

// エリア（今のアプリのエリア）
export const AREAS = ['新宿', '渋谷', '恵比寿', '代官山', '中目黒', '池袋'];

// ジャンル（今のアプリのジャンル）。Google の種類名（例：「イタリア料理店」「焼肉店」）を振り分ける
// 上から順に判定する
export const GENRES = ['イタリアン', '和食', '焼肉', 'カフェ', '中華', 'フレンチ', 'ラーメン'];
const GENRE_RULES = [
  { genre: 'ラーメン', re: /ラーメン|つけ麺|担々麺|まぜそば/ },
  { genre: '焼肉', re: /焼肉|焼き肉|ホルモン/ },
  { genre: 'カフェ', re: /カフェ|喫茶|コーヒー|珈琲/ },
  { genre: 'イタリアン', re: /イタリア|イタリアン|パスタ|ピザ|ピッツァ|トラットリア|リストランテ/ },
  { genre: 'フレンチ', re: /フレンチ|フランス|ビストロ/ },
  { genre: '中華', re: /中華|中国料理|四川|広東|上海|台湾料理|餃子|小籠包/ },
  { genre: '和食', re: /和食|日本料理|割烹|懐石|料亭|寿司|鮨|すし|天ぷら|天麩羅|そば|蕎麦|うどん|焼き鳥|焼鳥|やきとり|とんかつ|うなぎ|鰻|しゃぶしゃぶ|すき焼き|おでん|定食/ },
];
export function shopGenre(row) {
  const text = `${row?.genre || ''} ${row?.name || ''}`;
  const g = GENRE_RULES.find((r) => r.re.test(String(row?.genre || ''))) || GENRE_RULES.find((r) => r.re.test(text));
  return g ? g.genre : null;
}
// カードのラベル：振り分けたジャンル、なければ Google の種類名そのまま
export function genreLabel(row) {
  return shopGenre(row) || (row?.genre ? String(row.genre) : null);
}

// 評価（数字と件数）。データ元は Google
export const RATING_SOURCE = 'Google';
export function ratingOf(row) {
  const v = Number(row?.rating);
  if (!Number.isFinite(v) || v <= 0) return null;
  const n = Number(row?.user_ratings_total);
  return { value: v.toFixed(1), count: Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ja-JP')}件` : null };
}

// 営業中か（Google の regularOpeningHours.periods から、日本時間で判定）。分からなければ null
export function isOpenNow(hours, now = new Date()) {
  const periods = hours?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  // 24時間営業（close がない）
  if (periods.length === 1 && periods[0]?.open && !periods[0]?.close) return true;
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  const week = 7 * 24 * 60;
  const nowMin = jst.getDay() * 24 * 60 + jst.getHours() * 60 + jst.getMinutes();
  const toMin = (p) => (p.day ?? 0) * 24 * 60 + (p.hour ?? 0) * 60 + (p.minute ?? 0);
  return periods.some((p) => {
    if (!p?.open || !p?.close) return false;
    const o = toMin(p.open);
    let c = toMin(p.close);
    if (c <= o) c += week;
    const n = nowMin < o ? nowMin + week : nowMin;
    return n >= o && n < c;
  });
}

// 営業時間と定休日（Google の weekdayDescriptions：「月曜日: 11時00分～22時00分」「日曜日: 定休日」）
// 今日の営業時間（日本時間の曜日）。例「11:30〜15:00、17:30〜23:00」。24時間なら「24時間営業」
const DAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
const hm = (t) => `${String(t?.hour ?? 0).padStart(2, '0')}:${String(t?.minute ?? 0).padStart(2, '0')}`;
const jstDay = (now) => new Date(now.getTime() + 9 * 3600 * 1000).getUTCDay();
const isAllDay = (periods) => periods.length === 1 && periods[0]?.open && !periods[0]?.close;

export function todayHoursText(hours, now = new Date()) {
  const periods = hours?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  if (isAllDay(periods)) return '24時間営業';
  const day = jstDay(now);
  const today = periods.filter((p) => p?.open?.day === day);
  if (today.length === 0) return null;
  return today.map((p) => `${hm(p.open)}〜${p.close ? hm(p.close) : ''}`).join('、');
}

// 定休日（営業時間のデータに出てこない曜日）。例「月曜」「月曜・火曜」。データがなければ null
export function closedDaysText(hours) {
  const periods = hours?.periods;
  if (!Array.isArray(periods) || periods.length === 0 || isAllDay(periods)) return null;
  const open = new Set(periods.map((p) => p?.open?.day));
  const closed = [1, 2, 3, 4, 5, 6, 0].filter((d) => !open.has(d));
  return closed.length > 0 ? closed.map((d) => `${DAY_JA[d]}曜`).join('・') : null;
}

export function openingLines(hours) {
  const lines = hours?.weekdayDescriptions;
  return Array.isArray(lines) ? lines : [];
}

// 最寄り駅と徒歩の分（Google のデータにはないため、お店の位置と駅の位置から出す）
// 駅の位置は6エリアの周辺の駅。徒歩は直線距離の1.25倍を道のりとみなし、80mを1分とする（目安）
const STATIONS = [
  ['新宿', 35.6896, 139.7006], ['新宿三丁目', 35.6906, 139.7048], ['西新宿', 35.6944, 139.6928], ['都庁前', 35.6907, 139.6927],
  ['新宿御苑前', 35.6886, 139.7106], ['南新宿', 35.6834, 139.6986], ['代々木', 35.6834, 139.702], ['西武新宿', 35.696, 139.7006],
  ['新大久保', 35.7012, 139.7005], ['渋谷', 35.658, 139.7016], ['神泉', 35.6574, 139.6935], ['明治神宮前', 35.6686, 139.7055],
  ['原宿', 35.6702, 139.7027], ['表参道', 35.6652, 139.7123], ['恵比寿', 35.6467, 139.7101], ['広尾', 35.6522, 139.7222],
  ['代官山', 35.6481, 139.7033], ['中目黒', 35.644, 139.699], ['祐天寺', 35.6371, 139.6912], ['池尻大橋', 35.6505, 139.6844],
  ['池袋', 35.7295, 139.7109], ['東池袋', 35.7253, 139.7194], ['要町', 35.733, 139.6987], ['北池袋', 35.7412, 139.7166],
];
export function nearestStation(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best = null;
  for (const [name, la, ln] of STATIONS) {
    const dy = (lat - la) * 111000;
    const dx = (lng - ln) * 111000 * Math.cos((lat * Math.PI) / 180);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!best || d < best.d) best = { name, d };
  }
  if (!best || best.d > 2000) return null;
  const minutes = Math.max(1, Math.ceil((best.d * 1.25) / 80));
  return { name: `${best.name}駅`, minutes, label: `${best.name}駅 徒歩${minutes}分` };
}

// 外のページ（外のサービスのロゴは使わず、文字で示す）
export function externalLinks(row) {
  const name = String(row?.name || '');
  const q = encodeURIComponent(`${name} ${row?.area || ''}`.trim());
  return {
    // 今のアプリと同じ検索ページのURL
    hotpepper: `https://www.hotpepper.jp/gstr00000/?keyword=${encodeURIComponent(name)}`,
    maps: row?.place_id
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}&destination_place_id=${encodeURIComponent(row.place_id)}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`,
    tabelog: `https://tabelog.com/rst/rstlst/?vs=1&sa=&sk=${encodeURIComponent(name)}`,
  };
}

// ホームの絞り順（3回目 §7-7：「同じモグタイプに人気」「急上昇中」を追加。定期的に集計した表を使う）
export const SORTS = [
  { value: 'recommend', label: 'おすすめ' },
  { value: 'mogu_type_popular', label: '同じモグタイプに人気' },
  { value: 'trending', label: '急上昇中' },
];

// ホームの絞り込み（並び順・エリア・ジャンル・予算）
export const EMPTY_FILTERS = { sort: 'recommend', areas: [], genres: [], priceLevel: null };
export const filterCount = (f) => (f.areas.length > 0 ? 1 : 0) + (f.genres.length > 0 ? 1 : 0) + (f.priceLevel != null ? 1 : 0);
