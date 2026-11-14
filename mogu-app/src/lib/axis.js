// 食スタイル診断の4軸。判定・％・見出しの文章は、サイト（mogutype.com）とまったく同じにする。
// 出どころ：引き継ぎ一式 03_diagnosis_data/
//   ・diagnosis_rules.md §4（判定・％）
//   ・source/result-text.js（judge・percents・strongSegment）
//   ・result-axis-texts.json（blocks[文字][強さ].label ＝ 4軸カードの見出し）
// 確定版 Final-06 の画像に出ている見出し（例：「やや新規開拓を選ぶ傾向がある」）はデザインの見本の文章で、
// サイトの文章とは違う。見出しはサイトの文章を使う（けんとの指示 2026-11-14）。

export const AXIS_LABELS = [
  { key: 'VT', left: '映え', right: '味' },
  { key: 'NF', left: '新規開拓', right: '行きつけ' },
  { key: 'BG', left: 'コスパ重視', right: '奮発する' },
  { key: 'PL', left: '計画的', right: '衝動的' },
];

// 軸の名前（result-axis-texts.json の axes[].name）と、4軸カードの色
//   色は確定版 Final-06：01 緑・02 テラコッタ・03 モーブ・04 金
export const AXIS_META = [
  { key: 'VT', badge: 'お店選びの決め手', number: '01', left: 'V', right: 'T', main: '#4F7365', outline: '#728F84', mid: '#95ABA3', pale: '#CAD5D1' },
  { key: 'NF', badge: 'お店の開拓スタイル', number: '02', left: 'N', right: 'F', main: '#B0603F', outline: '#C08065', mid: '#D0A08C', pale: '#E7CFC5' },
  { key: 'BG', badge: 'お財布のゆるめ方', number: '03', left: 'B', right: 'G', main: '#9E5E70', outline: '#B17E8D', mid: '#C59EA9', pale: '#E2CFD4' },
  { key: 'PL', badge: 'リサーチ & 予約傾向', number: '04', left: 'P', right: 'L', main: '#8E6D22', outline: '#A58A4E', mid: '#BBA77A', pale: '#DDD3BD' },
];

// カードの地と文字（確定版 Final-06）
export const AXIS_CARD = { bg: '#2E2C2A', border: '#4A4744', text: '#FFFFFF', weak: '#A8A199', number: '#F5E6C8' };

// 4軸カードの見出し（result-axis-texts.json の blocks[文字][強さ].label を、そのままつなげたもの）
const HEADINGS = {
  V: { 1: 'やや映えを重視する', 2: '映えを重視する', 3: 'とことん映えを重視する' },
  T: { 1: 'やや味にこだわる', 2: '味にこだわる', 3: 'とことん味にこだわる' },
  N: { 1: 'やや新規開拓の志向がある', 2: '新規開拓の志向がある', 3: '強い新規開拓の志向がある' },
  F: { 1: 'やや行きつけを選ぶ傾向がある', 2: '行きつけを選ぶ傾向がある', 3: 'かなり行きつけを選ぶ傾向がある' },
  B: { 1: 'ややコスパを重視', 2: 'コスパを重視', 3: 'かなりコスパを重視' },
  G: { 1: 'やや奮発する傾向がある', 2: '奮発する傾向がある', 3: '頻繁に奮発する傾向がある' },
  P: { 1: 'やや計画的', 2: '計画的', 3: 'とても計画的' },
  L: { 1: 'やや衝動的', 2: '衝動的', 3: 'とても衝動的' },
};

// 軸の値（0〜3・0.2刻み）→ 5問の合計点（0〜15）。0.2刻みでなければ null（result-text.js の scoreToSum）
export function scoreToSum(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  const raw = value * 5;
  const sum = Math.round(raw);
  if (Math.abs(raw - sum) > 0.01 || sum < 0 || sum > 15) return null;
  return sum;
}

// 合計点 → 右の文字かどうかと、強さ 1〜3（result-text.js の judge）
export function judge(sum) {
  const right = sum >= 8;
  const level = right ? (sum <= 9 ? 1 : sum <= 12 ? 2 : 3) : sum <= 2 ? 3 : sum <= 5 ? 2 : 1;
  return { right, level };
}

// 合計点 → ％（result-text.js の percents）
export function percentsBySum(sum) {
  const right = Math.round((sum * 100) / 15);
  return { left: 100 - right, right };
}

// ゲージの6つの区切りのどこにいるか 0〜5（result-text.js の strongSegment）
export function strongSegment(sum) {
  const result = judge(sum);
  return result.right ? 2 + result.level : 3 - result.level;
}

// 軸の値 → ％。0.2刻みでない値（ありえないはずだが念のため）は、合計点に直さず比で出す
export function axisPercent(value) {
  const sum = scoreToSum(value);
  if (sum !== null) return percentsBySum(sum);
  const v = Number.isFinite(Number(value)) ? Number(value) : 1.5;
  const right = Math.round((v / 3) * 100);
  return { left: 100 - right, right };
}

// 軸の値 → 見出しの文章（サイトの結果画面と同じ）
export function axisHeading(key, value) {
  const meta = AXIS_META.find((m) => m.key === key);
  if (!meta) return '';
  const sum = scoreToSum(value);
  if (sum === null) return '';
  const { right, level } = judge(sum);
  return HEADINGS[right ? meta.right : meta.left]?.[level] || '';
}
