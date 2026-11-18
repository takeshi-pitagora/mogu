// =============================================================
// ⑱ お店を登録する②：情報の入力（確定版 Final-18）
//   必須の5つの選択肢は、確定版の文言そのまま
// =============================================================

// 必須の5つ（1画面に1問）
export const REQUIRED_STEPS = ['station', 'genre', 'visit', 'photos', 'highlight'];

// ジャンル（⑱-3。1つ目がメイン、2つ目がサブ）
export const GENRES = [
  'イタリアン', '和食', '焼肉', 'カフェ', '中華', 'フレンチ', 'ラーメン', '寿司',
  '居酒屋', 'バー', '韓国料理', 'エスニック', 'カレー', 'ハンバーガー', 'スイーツ', 'パン',
];

// 予算感（§6-6。8つ。みんなが使った金額の投票）
export const BUDGET_BUCKETS = [
  { value: 1, label: '〜¥1,000' },
  { value: 2, label: '¥1,000〜¥2,000' },
  { value: 3, label: '¥2,000〜¥3,000' },
  { value: 4, label: '¥3,000〜¥4,000' },
  { value: 5, label: '¥4,000〜¥5,000' },
  { value: 6, label: '¥5,000〜¥7,000' },
  { value: 7, label: '¥7,000〜¥10,000' },
  { value: 8, label: '¥10,000〜' },
];
export const budgetBucketLabel = (v) => BUDGET_BUCKETS.find((b) => b.value === Number(v))?.label || null;

// 時間（昼／夜）
export const TIME_OF_DAY = [
  { value: 'lunch', label: '昼' },
  { value: 'dinner', label: '夜' },
];

// 性別（はじめて予算感を入れるときだけ。予算を男女別に出すためだけに使う）
export const GENDERS = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'no_answer', label: '答えない' },
];

// イチ押しポイント（⑱-8。8つから1〜2つ）
export const HIGHLIGHTS = [
  { key: 'taste', label: '味' },
  { key: 'mood', label: '雰囲気' },
  { key: 'value', label: 'コスパ' },
  { key: 'portion', label: '量' },
  { key: 'look', label: '見た目' },
  { key: 'drink', label: 'ドリンク' },
  { key: 'service', label: '接客' },
  { key: 'comfort', label: '居心地' },
];
export const HIGHLIGHT_MAX = 2;
export const HIGHLIGHT_REASON_MAX = 40;

// 写真の種類（⑱-7。写真の左下に出す）
export const PHOTO_KINDS = [
  { value: 'food', label: '料理' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'interior', label: '店内' },
  { value: 'exterior', label: '外観' },
  { value: 'menu', label: 'メニュー表' },
];
export const PHOTO_MAX = 10;
export const PHOTO_MIN_SHORT_SIDE = 720; // app_settings の photo_min_short_side と同じ
export const photoKindLabel = (v) => PHOTO_KINDS.find((k) => k.value === v)?.label || '料理';

export const WALK_MIN_MAX = 60;

// 空っぽの入力（下書きもこの形で持つ）
export function emptyForm(name = '') {
  return {
    name,
    station: null, // { id, name, ward, line }
    walkMin: '',
    genreMain: null,
    genreSub: null,
    visitedOn: null, // 'YYYY-MM-DD'
    timeOfDay: null,
    budgetBucket: null,
    gender: null,
    photos: [], // { id, file, url, kind, width, height, tooSmall }
    highlightKeys: [],
    highlightReason: '',
    fields: {},
    tags: [],
    menu: [],
    limited: [], // 期間限定メニュー
    comment: '',
    notRelated: false, // 「関係者ではありません」
  };
}

// その問いに答えられているか（必須の5つ）
export function stepDone(form, step) {
  switch (step) {
    case 'station':
      return !!form.station && String(form.walkMin).trim() !== '' && Number(form.walkMin) >= 0;
    case 'genre':
      return !!form.genreMain;
    case 'visit':
      return !!form.visitedOn && !!form.timeOfDay && !!form.budgetBucket;
    case 'photos':
      return form.photos.filter((p) => !p.tooSmall).length > 0;
    case 'highlight':
      return form.highlightKeys.length > 0;
    default:
      return false;
  }
}

export function requiredDoneCount(form) {
  return REQUIRED_STEPS.filter((s) => stepDone(form, s)).length;
}

// 「あとNつ：写真・イチ押しポイント」（⑱-15）
const STEP_LABEL = {
  station: '最寄駅',
  genre: 'ジャンル',
  visit: '行った日と予算感',
  photos: '写真',
  highlight: 'イチ押しポイント',
};
export function missingLabels(form) {
  return REQUIRED_STEPS.filter((s) => !stepDone(form, s)).map((s) => STEP_LABEL[s]);
}

// しっかり登録（§6-2。写真3枚＋任意5つ＝8つの線）
export const FULL_PHOTOS = 3;
export const FULL_FIELDS = 5;
export function fullRegisterCount(form) {
  const photos = Math.min(FULL_PHOTOS, form.photos.filter((p) => !p.tooSmall).length);
  const fields = Math.min(FULL_FIELDS, filledFieldCount(form));
  return { photos, fields, total: photos + fields, max: FULL_PHOTOS + FULL_FIELDS };
}
export function filledFieldCount(form) {
  let n = Object.values(form.fields || {}).filter((v) => String(v ?? '').trim() !== '').length;
  if (form.menu?.length > 0) n += 1;
  if (form.tags?.length > 0) n += 1;
  if (String(form.comment ?? '').trim() !== '') n += 1;
  return n;
}

// 日付（ローカルの日付のまま 'YYYY-MM-DD' にする）
export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayKey() {
  return toDateKey(new Date());
}
export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}
export function visitedLabel(key) {
  if (!key) return null;
  if (key === todayKey()) return '今日';
  if (key === yesterdayKey()) return '昨日';
  const [y, m, d] = key.split('-');
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}
