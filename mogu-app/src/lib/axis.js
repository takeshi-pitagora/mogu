// 食スタイル診断の4軸（確定版 Final-03・Final-06 で共通に使う）
// axisValues は 0（左そのもの）〜3（右そのもの）。％の式は修正指示書（第4回）§4-2：
//   left% = round((1 − 値÷3) × 100)、right% = 100 − left%
export const AXIS_LABELS = [
  { key: 'VT', left: '映え', right: '味' },
  { key: 'NF', left: '新規開拓', right: '行きつけ' },
  { key: 'BG', left: 'コスパ重視', right: '奮発する' },
  { key: 'PL', left: '計画的', right: '衝動的' },
];

// 4軸のカード（確定版 Final-06 の HTML の値）。軸ごとの色は「01 緑・02 テラコッタ・03 モーブ・04 金」
export const AXIS_META = [
  { key: 'VT', badge: 'お店選びの決め手', number: '01', main: '#4F7365', outline: '#728F84', mid: '#95ABA3', pale: '#CAD5D1' },
  { key: 'NF', badge: 'お店の開拓スタイル', number: '02', main: '#B0603F', outline: '#C08065', mid: '#D0A08C', pale: '#E7CFC5' },
  { key: 'BG', badge: 'お財布のゆるめ方', number: '03', main: '#9E5E70', outline: '#B17E8D', mid: '#C59EA9', pale: '#E2CFD4' },
  { key: 'PL', badge: 'リサーチ ＆ 予約傾向', number: '04', main: '#8E6D22', outline: '#A58A4E', mid: '#BBA77A', pale: '#DDD3BD' },
];

// カードの地と文字（確定版 Final-06）
export const AXIS_CARD = { bg: '#2E2C2A', border: '#4A4744', text: '#FFFFFF', weak: '#A8A199', number: '#F5E6C8' };

export function axisPercent(value) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 1.5;
  const left = Math.round(((3 - v) / 3) * 100);
  return { left, right: 100 - left };
}

// 【要確認】4軸の見出し文。
//   修正指示書 §4-2 と引き渡し書では「渡した 03_diagnosis_data のサイトと同じ出し方で作る」とあるが、
//   03_diagnosis_data は今回の ZIP（PNG・HTML）のどちらにも入っていなかったため、サイトの本当のルールが分からない。
//   ここは確定版 Final-06 の見本4つ（映えを重視する／やや新規開拓を選ぶ傾向がある／ややコスパを重視／計画的）が
//   そのまま再現できるように置いた仮のルール。03_diagnosis_data をもらえたら、この表ごと差し替える。
const SOFT_AT = 65; // これ未満を「やや…」にすると、見本の 80・67・60・53 が4つとも一致する
const HEADINGS = {
  VT: { left: ['映えを重視する', 'やや映えを重視する'], right: ['味を重視する', 'やや味を重視する'] },
  NF: { left: ['新規開拓を選ぶ', 'やや新規開拓を選ぶ傾向がある'], right: ['行きつけを選ぶ', 'やや行きつけを選ぶ傾向がある'] },
  BG: { left: ['コスパを重視する', 'ややコスパを重視'], right: ['奮発する', 'やや奮発する'] },
  PL: { left: ['計画的', 'やや計画的'], right: ['衝動的', 'やや衝動的'] },
};

export function axisHeading(key, leftStrong, percent) {
  const pair = HEADINGS[key]?.[leftStrong ? 'left' : 'right'];
  if (!pair) return '';
  return percent >= SOFT_AT ? pair[0] : pair[1];
}
