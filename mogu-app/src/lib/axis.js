// 食スタイル診断の4軸（確定版 Final-03・Final-06 で共通に使う）
// axisValues は 0（左そのもの）〜3（右そのもの）。％の式は引き渡し書 §4-2：
//   left% = round((1 - value/3) × 100)、right% = 100 - left%
export const AXIS_LABELS = [
  { key: 'VT', left: '映え', right: '味' },
  { key: 'NF', left: '新規開拓', right: '行きつけ' },
  { key: 'BG', left: 'コスパ重視', right: '奮発する' },
  { key: 'PL', left: '計画的', right: '衝動的' },
];

// ⑥の4軸カードの見出し（「お店選びの決め手」など）と番号
export const AXIS_META = [
  { key: 'VT', badge: 'お店選びの決め手', number: '01' },
  { key: 'NF', badge: 'お店の開拓スタイル', number: '02' },
  { key: 'BG', badge: 'お財布のゆるめ方', number: '03' },
  { key: 'PL', badge: 'リサーチ＆予約傾向', number: '04' },
];

export function axisPercent(value) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 1.5;
  const left = Math.round(((3 - v) / 3) * 100);
  return { left, right: 100 - left };
}

// 見出し文（4回目の確定版の見本：映え80%→「映えを重視する」／新規開拓60%→「やや新規開拓を選ぶ傾向がある」／
// コスパ重視53%→「ややコスパを重視」／計画的67%→「計画的」）。
// 見本どおりの正確な生成ルールは引き継ぎ資料（01_site_overview.md）にしかないため、
// ここは％の強さから作った仮のルール。サイトの文言と違う場合は要確認（4回目 §3-2）。
export function axisHeading(label, percent) {
  if (percent >= 75) return `${label}を重視する`;
  if (percent >= 60) return `やや${label}を選ぶ傾向がある`;
  return `やや${label}を重視`;
}
