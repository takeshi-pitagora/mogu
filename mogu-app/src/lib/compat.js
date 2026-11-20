// =============================================================
// ③-11・12「あなたとの相性」
//
// ！！要確認（けんとへ）！！
//   引き渡し書 §5 ③に「％と帯の文は、サイトと同じ式と文章で出します
//   （MoguType_app_handoff_2026-11-02.zip の 03_diagnosis_data/diagnosis_rules.md §5
//   と相性の文章）」とあります。その diagnosis_rules.md がこちらに届いていないため、
//   いまは確定版 Final-03-Profile の 12 に書かれている決まりだけで作っています：
//     ・使うのは「お店選びの決め手（VT）」と「お財布のゆるめ方（BG）」の2つだけ
//     ・「相性は、この2つの近さで決まります（50〜100%）」
//   サイトの式と文章をもらえたら、この1ファイルを置きかえれば画面はそのまま動きます。
// =============================================================

export const AXIS_MAX = 3;

const num = (v, fallback = 1.5) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

// 4軸の値（0〜3）を取り出す
export function axesOf(row) {
  const a = row?.food_axes || row?.mogu_type_axis_values || {};
  return {
    VT: num(a.VT ?? a.vt),
    NF: num(a.NF ?? a.nf),
    BG: num(a.BG ?? a.bg),
    PL: num(a.PL ?? a.pl),
  };
}

// 相性（50〜100%）。2つの軸の近さだけで決まる
export function compatPercent(me, you) {
  const a = axesOf(me);
  const b = axesOf(you);
  const d = (Math.abs(a.VT - b.VT) + Math.abs(a.BG - b.BG)) / 2 / AXIS_MAX; // 0（同じ）〜1（正反対）
  return Math.round(100 - 50 * d);
}

// 帯の見出しと文（確定版 Final-03-Profile の 11・12 の言い方にそろえた仮の文）
export function compatText(me, you) {
  const a = axesOf(me);
  const b = axesOf(you);
  const dv = Math.abs(a.VT - b.VT);
  const dg = Math.abs(a.BG - b.BG);
  const near = (d) => d <= 1;

  if (near(dv) && near(dg)) {
    return {
      title: 'お店選びとお財布が近いふたり',
      body: 'いっしょに行くお店で迷いにくい。見た目のいいお店に、少し奮発して行ける',
    };
  }
  if (near(dv)) {
    return {
      title: 'お店の選び方が似ているふたり',
      body: '行きたいお店は合いやすい。予算だけ先に決めておくと、もっと楽になる',
    };
  }
  if (near(dg)) {
    return {
      title: 'お財布の感じが近いふたり',
      body: '金額で困りにくい。お店は、どちらかの「ここ」に乗ってみると早い',
    };
  }
  return {
    title: 'ちがうから広がるふたり',
    body: '選び方も予算も少しちがう。交代でお店を決めると、知らないお店に出会える',
  };
}

// 「ふたりの位置」に出す2つの軸
export const COMPAT_AXES = [
  { key: 'VT', label: 'お店選びの決め手', left: '映え', right: '味' },
  { key: 'BG', label: 'お財布のゆるめ方', left: 'コスパ重視', right: '奮発する' },
];
