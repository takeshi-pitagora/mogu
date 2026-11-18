// =============================================================
// ⑱ 任意の項目（確定版 Final-18 の9〜13）
//   shop_fields は {field_key: value} の形。値は文字にして入れる
//   いくつでも選べるものは「,」でつなぐ
// =============================================================

export const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
export const HOURS_KEYS = WEEKDAYS.map((_, i) => `hours_${i}`); // hours_0 = 月
export const CLOSED = '定休日';

// ひと組ずつ選ぶもの／いくつでも選ぶもの
export const FIELD_GROUPS = [
  {
    key: 'reserve',
    title: '予約',
    multi: false,
    options: ['できる', 'できない', '予約必須'],
  },
  {
    key: 'payment',
    title: '支払い',
    multi: true,
    hint: 'いくつでも',
    options: ['現金', 'カード', '電子マネー', 'QRコード決済'],
  },
  {
    key: 'seats',
    title: '席',
    multi: true,
    hint: 'いくつでも',
    options: ['カウンター', 'テーブル', '個室', '座敷', 'テラス'],
  },
  {
    key: 'seat_count',
    title: '席数の目安',
    multi: false,
    options: ['〜10', '〜30', '30〜'],
  },
  {
    key: 'party',
    title: '何人で行くか',
    multi: true,
    options: ['1人で入りやすい', '2人向き', '大人数OK'],
  },
  {
    key: 'smoking',
    title: 'たばこ',
    multi: false,
    options: ['全席禁煙', '分煙', '喫煙席あり'],
  },
  {
    key: 'facility',
    title: '設備',
    multi: true,
    hint: 'いくつでも',
    options: ['電源', 'Wi-Fi', '子ども連れOK', 'ペットOK', '車いすOK'],
  },
];

// 「席数の目安」は「席」の中に出す（確定版のならび）
export const GROUP_LAYOUT = [
  { title: '支払い', keys: ['payment'] },
  { title: '席', keys: ['seats', 'seat_count'] },
  { title: '何人で行くか', keys: ['party'] },
  { title: 'たばこ', keys: ['smoking'] },
];

export const groupOf = (key) => FIELD_GROUPS.find((g) => g.key === key);

// いくつでも選ぶものの読み書き
export const splitValues = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
export const joinValues = (list) => list.join(',');

export function toggleField(fields, key, option) {
  const g = groupOf(key);
  const next = { ...fields };
  if (!g?.multi) {
    if (next[key] === option) delete next[key];
    else next[key] = option;
    return next;
  }
  const cur = splitValues(next[key]);
  const after = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
  if (after.length === 0) delete next[key];
  else next[key] = joinValues(after);
  return next;
}

export function isPicked(fields, key, option) {
  const g = groupOf(key);
  if (!g?.multi) return fields[key] === option;
  return splitValues(fields[key]).includes(option);
}

// 上限
export const MENU_MAX = 3;
export const LIMITED_MAX = 3;
export const LINK_MAX = 3;
export const FREE_TEXT_MAX = 200;
export const MENU_NAME_MAX = 30;

// 営業時間の文字（'17:00〜24:00' か '定休日'）
export function hoursLabel(fields, index) {
  return fields[HOURS_KEYS[index]] || null;
}
export function setHours(fields, index, value) {
  const next = { ...fields };
  if (!value) delete next[HOURS_KEYS[index]];
  else next[HOURS_KEYS[index]] = value;
  return next;
}

// 30分きざみの時刻（25:00 まで。深夜を 24:00〜 で書けるように）
export const TIME_CHOICES = (() => {
  const out = [];
  for (let m = 0; m <= 26 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
})();

// リンク（最大3つ）は link_1..3 に入れる
export const LINK_KEYS = ['link_1', 'link_2', 'link_3'];
export const PHONE_KEY = 'phone';
export const FREE_TEXT_KEY = 'free_text';

export function linkList(fields) {
  return LINK_KEYS.map((k) => fields[k]).filter((v) => String(v ?? '').trim() !== '');
}

// http(s) だけ通す（入力のまちがいをその場で知らせる）
export function linkError(url) {
  const v = String(url ?? '').trim();
  if (v === '') return null;
  if (!/^https?:\/\/\S+$/i.test(v)) return 'https:// から始まるリンクを入れてください';
  return null;
}

export function phoneError(v) {
  const t = String(v ?? '').trim();
  if (t === '') return null;
  if (!/^[0-9０-９+\-() ]{8,20}$/.test(t)) return '電話番号をもう一度見てください';
  return null;
}
