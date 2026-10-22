// =============================================================
// グループ向けお店レコメンド（Mogu Type 診断の4軸を使う）
//
// 入力:
//   - ユーザー: 診断の4軸スコア { VT, NF, BG, PL }（各 0〜3。mogutype.com と同じスケール）
//               0 = 左（V 見た目派 / N 新規開拓 / B コスパ重視 / P きっちり派）
//               3 = 右（T 味覚派   / F 行きつけ / G 奮発する   / L ノリ重視）
//   - お店: restaurants テーブルの行（name, genre, price_level, rating, user_ratings_total）
//
// 考え方:
//   - VT（見た目/味）と BG（予算）は「近いほど合う」軸 → 1人ずつの相性に使う
//   - NF（開拓）と PL（計画性）は「違っても役割分担できる」軸 → グループ全体の補正に使う
//     （mogutype.com の相性計算で NF/PL が相性に影響しない設計と揃えている）
//   - グループの点数 = 平均と「一番満足度の低い人」の組み合わせ（誰かが我慢しすぎない）
//   - 予算は誰かの希望を大きく超える店を足切り
//   - 同じジャンルばかり並ばないよう、最後に多様性を考慮して並べ替える
//
// パラメータは tools/reco-sim のシミュレーション（16×16タイプの全組み合わせ）で調整済み。
// =============================================================

export const AXIS_MAX = 3;
const AXES = ['VT', 'NF', 'BG', 'PL'];

export const DEFAULT_PARAMS = {
  // 1人ずつの相性の重み
  wTaste: 0.41, // 見た目/味の一致
  wBudget: 0.55, // 予算の一致（不満に直結しやすいので最も重い）
  wQuality: 0.06, // お店の評価の高さ
  qualityByTaste: true, // 味覚派ほど評価の高さを重視する
  // 予算
  overPenalty: 0.3, // 希望より1段階高いごとの減点
  underPenalty: 0.065, // 希望より1段階安いごとの減点（安いのは高いより許されやすい）
  hardOverLevels: 0.9, // 誰かの希望より約1段階以上高い店は除外（予算オーバーは0件にする）
  unknownPriceShrink: 0.16, // 価格が推定値のときは予算の評価を中立(0.5)へ少し寄せる
  // グループ
  alpha: 0.75, // 平均の比重（残りの0.25は一番満足度の低い人）
  nfBoost: 0.1, // 開拓/行きつけ傾向による補正（上限0.1＝あくまで微調整）
  plBoost: 0.085, // 予約しやすい店/ふらっと入れる店の補正
  // 並べ替え
  diversityLambda: 0.02, // 同じジャンルが続くことへの減点
  // タイプコードしか分からない場合の軸の値（0〜3）
  typeLeftValue: 0.75,
  typeRightValue: 2.25,
};

// ---------------------------------------------------------------
// ジャンル判定（Google の primaryTypeDisplayName 等の日本語文字列に対応）
// vt: 0=映え寄り 1=味寄り / est: 価格不明時の推定価格帯(1〜4) / book: 予約しやすさ(0〜1)
// 上から順に判定する（「ハンバーガー」が「バー」に当たらないよう順序に意味がある）
// ---------------------------------------------------------------
const GENRES = [
  { key: 'burger', label: 'ハンバーガー', re: /ハンバーガー|バーガー/, vt: 0.5, est: 2, book: 0.1 },
  { key: 'cafe', label: 'カフェ', re: /カフェ|喫茶|コーヒー|珈琲|ベーカリー/, vt: 0.15, est: 2, book: 0.2 },
  { key: 'sweets', label: 'スイーツ', re: /スイーツ|パフェ|パンケーキ|ケーキ|デザート|フルーツサンド/, vt: 0.1, est: 2, book: 0.15 },
  { key: 'noodle', label: 'ラーメン・麺', re: /ラーメン|つけ麺|そば|蕎麦|うどん/, vt: 0.9, est: 1, book: 0.05 },
  { key: 'teishoku', label: '定食・食堂', re: /定食|食堂|丼|牛丼/, vt: 0.8, est: 1, book: 0.05 },
  { key: 'yakiniku', label: '焼肉', re: /焼肉|ホルモン|ステーキ/, vt: 0.75, est: 3, book: 0.7 },
  { key: 'sushi', label: '寿司', re: /寿司|鮨|すし/, vt: 0.85, est: 3, book: 0.6 },
  { key: 'yakitori', label: '焼き鳥', re: /焼き鳥|焼鳥|やきとり|串/, vt: 0.8, est: 3, book: 0.5 },
  { key: 'washoku', label: '和食', re: /和食|割烹|懐石|日本料理|料亭/, vt: 0.7, est: 3, book: 0.8 },
  { key: 'izakaya', label: '居酒屋', re: /居酒屋|酒場|立ち飲み|大衆/, vt: 0.6, est: 2, book: 0.4 },
  { key: 'winebar', label: 'ワインバー・バル', re: /ワインバー|バル/, vt: 0.4, est: 3, book: 0.5 },
  { key: 'bar', label: 'バー', re: /バー|ラウンジ/, vt: 0.25, est: 3, book: 0.3 },
  { key: 'bistro', label: 'ビストロ', re: /ビストロ/, vt: 0.45, est: 3, book: 0.7 },
  { key: 'french', label: 'フレンチ', re: /フレンチ|フランス/, vt: 0.45, est: 4, book: 0.9 },
  { key: 'italian', label: 'イタリアン', re: /イタリアン|イタリア|パスタ|ピザ|ピッツァ/, vt: 0.45, est: 3, book: 0.7 },
  { key: 'chinese', label: '中華', re: /中華|小籠包|餃子|四川/, vt: 0.7, est: 2, book: 0.4 },
  { key: 'ethnic', label: 'エスニック', re: /エスニック|タイ料理|ベトナム|カレー|インド|ネパール|スパイス|韓国/, vt: 0.65, est: 2, book: 0.3 },
  { key: 'other', label: 'レストラン', re: /レストラン|ダイニング|創作|料理/, vt: 0.5, est: 3, book: 0.6 },
];
const OTHER_GENRE = { key: 'other', label: 'お店', vt: 0.5, est: 3, book: 0.5 };

// 行きつけ派が通いやすい「定番」ジャンル（開拓派には新鮮味が薄い）
const FAMILIAR_GENRES = new Set(['teishoku', 'noodle', 'chinese', 'izakaya', 'yakitori', 'burger', 'cafe', 'sushi']);
// 開拓派が喜びやすい「冒険」ジャンル
const ADVENTUROUS_GENRES = new Set(['ethnic', 'winebar', 'bistro', 'french', 'other']);

const VISUAL_WORDS = /おしゃれ|オシャレ|テラス|ルーフトップ|夜景|パノラマ|個室|貸切|パーティー|ラウンジ|ガーデン|映え|インスタ/;
const TASTE_WORDS = /炭火|本格|専門|直送|老舗|名店|鮨|割烹|こだわり|手打ち|自家製/;
const CHEAP_WORDS = /立ち飲み|立ち食い|回転|チェーン|大衆|食堂|牛丼/;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function detectGenre(row) {
  const genreText = String(row.genre || '');
  const nameText = String(row.name || '');
  return (
    GENRES.find((g) => g.re.test(genreText)) ||
    GENRES.find((g) => g.re.test(nameText)) ||
    OTHER_GENRE
  );
}

// ---------------------------------------------------------------
// お店の特徴量
// ---------------------------------------------------------------
export function shopFeatures(row) {
  const g = detectGenre(row);
  const name = String(row.name || '');

  // 見た目(0)〜味(1)
  let vt = g.vt;
  if (VISUAL_WORDS.test(name)) vt -= 0.15;
  if (TASTE_WORDS.test(name)) vt += 0.1;

  // 価格帯 1〜4（0=無料 は 1 扱い）。不明ならジャンルから推定
  const known = Number.isFinite(row.price_level) && row.price_level !== null;
  let priceLevel = known ? Math.max(1, Math.min(4, Math.round(row.price_level))) : g.est;
  if (!known && CHEAP_WORDS.test(name)) priceLevel = Math.max(1, priceLevel - 1);

  // 評価の高さ（口コミが少ない店は平均に寄せる＝ベイズ平均）
  const rating = Number(row.rating) || 0;
  const votes = Number(row.user_ratings_total) || 0;
  const PRIOR_VOTES = 50;
  const PRIOR_RATING = 3.8;
  const bayes = rating > 0 ? (votes * rating + PRIOR_VOTES * PRIOR_RATING) / (votes + PRIOR_VOTES) : PRIOR_RATING;
  const quality = clamp01((bayes - 3.4) / 1.2);

  // 新しさ・隠れ家度（口コミが少ないほど高い）。行きつけ派には逆に「定番度」として使う
  const popularity = Math.log1p(votes) / Math.log1p(3000);
  const genreNovelty = ADVENTUROUS_GENRES.has(g.key) ? 1 : FAMILIAR_GENRES.has(g.key) ? 0 : 0.5;
  const novelty = clamp01(0.6 * (1 - popularity) + 0.4 * genreNovelty);

  // 予約しやすさ
  let bookable = g.book + (priceLevel >= 3 ? 0.15 : 0) - (CHEAP_WORDS.test(name) ? 0.3 : 0);

  return {
    genreKey: g.key,
    genreLabel: g.label,
    vt: clamp01(vt),
    priceLevel,
    priceKnown: known,
    quality,
    novelty,
    bookable: clamp01(bookable),
  };
}

// ---------------------------------------------------------------
// ユーザーの4軸
// ---------------------------------------------------------------

// 4文字のタイプコード（例: "VNBP"）しか無い場合に、軸の値を作る
export function axesFromTypeCode(code, params = DEFAULT_PARAMS) {
  const c = String(code || '').toUpperCase();
  const left = ['V', 'N', 'B', 'P'];
  const out = {};
  AXES.forEach((axis, i) => {
    out[axis] = c[i] === left[i] ? params.typeLeftValue : params.typeRightValue;
  });
  return out;
}

// 0〜3 の軸の値 → 0〜1。欠けている軸は中間(0.5)
export function normalizeAxes(axes) {
  const n = {};
  AXES.forEach((axis) => {
    const v = Number(axes?.[axis]);
    n[axis.toLowerCase()] = Number.isFinite(v) ? clamp01(v / AXIS_MAX) : 0.5;
  });
  return n; // { vt, nf, bg, pl }
}

// 予算の希望（1〜4の価格帯）
export function preferredPriceLevel(u) {
  return 1 + u.bg * 3;
}

// ---------------------------------------------------------------
// 1人 × 1店 の相性（0〜1）
// ---------------------------------------------------------------
export function personFit(u, s, params = DEFAULT_PARAMS) {
  const P = params;
  const taste = 1 - Math.abs(u.vt - s.vt);

  const pref = preferredPriceLevel(u);
  const diff = s.priceLevel - pref; // プラス = 希望より高い
  let budget = diff > 0 ? 1 - diff * P.overPenalty : 1 + diff * P.underPenalty;
  budget = clamp01(budget);
  if (!s.priceKnown) budget = budget * (1 - P.unknownPriceShrink) + 0.5 * P.unknownPriceShrink;

  // 味覚派ほど評価の高さを重視（見た目派には評価の差が効きにくい）
  const qualityWeight = P.qualityByTaste ? P.wQuality * (0.4 + 1.2 * u.vt) : P.wQuality;

  const total = P.wTaste + P.wBudget + qualityWeight;
  const score = (P.wTaste * taste + P.wBudget * budget + qualityWeight * s.quality) / total;

  return {
    score,
    taste,
    budget,
    overBudget: diff >= P.hardOverLevels,
  };
}

// ---------------------------------------------------------------
// グループ × 1店 の点数
// ---------------------------------------------------------------
export function groupScore(users, s, params = DEFAULT_PARAMS) {
  const P = params;
  const fits = users.map((u) => personFit(u, s, P));
  if (fits.some((f) => f.overBudget)) {
    return { score: -1, excluded: true, fits };
  }
  const scores = fits.map((f) => f.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  let score = P.alpha * mean + (1 - P.alpha) * min;

  // NF: 開拓派が多いほど新しい店、行きつけ派が多いほど定番店を少し上げる（中心で ±0）
  const nf = users.reduce((a, u) => a + u.nf, 0) / users.length;
  score += P.nfBoost * ((1 - nf) * s.novelty + nf * (1 - s.novelty) - 0.5);

  // PL: きっちり派が1人でもいれば予約できる店、全員ノリ派ならふらっと入れる店を少し上げる
  const planner = Math.max(...users.map((u) => 1 - u.pl));
  score += P.plBoost * (planner * s.bookable + (1 - planner) * (1 - s.bookable) - 0.5);

  return { score, excluded: false, fits, mean, min };
}

// 点数 → 表示用の「相性%」（50〜99%）
// シミュレーションで、好みも予算も同じペアの上位店が約93%、両方ちがうペアが約75%になるよう調整
export function toPercent(score) {
  return Math.round(50 + 49 * clamp01((score - 0.633) / 0.327));
}

// ---------------------------------------------------------------
// おすすめ理由（カードに出す短い一文）
// ---------------------------------------------------------------
function buildReason(users, s, result) {
  const minTaste = Math.min(...result.fits.map((f) => f.taste));
  const minBudget = Math.min(...result.fits.map((f) => f.budget));
  const avgVt = users.reduce((a, u) => a + u.vt, 0) / users.length;
  const who = users.length === 2 ? '2人' : 'みんな';

  if (minTaste >= 0.8 && minBudget >= 0.8) {
    return `${who}の好みも予算感もぴったり`;
  }
  if (minBudget >= 0.85) {
    return minTaste >= 0.65
      ? `${who}の予算にちょうどいい${s.genreKey === 'other' ? 'お店' : s.genreLabel}`
      : `予算は${who}にぴったり。好みの違いの間をとった一軒`;
  }
  if (minTaste >= 0.8) {
    return avgVt < 0.5 ? `${who}とも気に入りそうな雰囲気のお店` : `${who}とも味で選びたくなるお店`;
  }
  const spread = Math.max(...users.map((u) => u.vt)) - Math.min(...users.map((u) => u.vt));
  if (spread >= 0.4) return '見た目派と味覚派、どちらも満足しやすい一軒';
  return `${who}のバランスがいい${s.genreKey === 'other' ? 'お店' : s.genreLabel}`;
}

// ---------------------------------------------------------------
// メイン: グループにおすすめのお店を並べる
//   members: [{ axes: {VT,NF,BG,PL} } または { type: 'VNBP' }]
//   rows:    restaurants テーブルの行
// ---------------------------------------------------------------
export function recommend(members, rows, { limit = 20, params = DEFAULT_PARAMS } = {}) {
  const P = params;
  const users = members.map((m) => normalizeAxes(m.axes || axesFromTypeCode(m.type, P)));

  const scored = [];
  for (const row of rows) {
    const s = shopFeatures(row);
    const r = groupScore(users, s, P);
    if (!r.excluded) scored.push({ row, s, r });
  }
  scored.sort((a, b) => b.r.score - a.r.score || b.s.quality - a.s.quality);

  // 多様性を考慮した並べ替え（同じジャンルが続くと少し減点）
  const picked = [];
  const pool = scored.slice(0, Math.max(limit * 4, 40));
  const genreCount = {};
  while (picked.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    pool.forEach((c, i) => {
      const val = c.r.score - P.diversityLambda * (genreCount[c.s.genreKey] || 0);
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    });
    const [c] = pool.splice(bestIdx, 1);
    genreCount[c.s.genreKey] = (genreCount[c.s.genreKey] || 0) + 1;
    picked.push(c);
  }

  return picked.map(({ row, s, r }) => ({
    restaurant: row,
    score: r.score,
    percent: toPercent(r.score),
    reason: buildReason(users, s, r),
    features: s,
    memberFits: r.fits.map((f) => Math.round(f.score * 100)),
  }));
}

// ---------------------------------------------------------------
// 2人のタイプ相性（mogutype.com の calculateCompatibility と同じ式）
//   VT・BG は差が小さいほど高く、NF・PL は常に満点（違っても役割分担できる）
// ---------------------------------------------------------------
export function pairCompatibility(axesA, axesB) {
  const modes = { VT: 'similar', NF: 'fixed', BG: 'similar', PL: 'fixed' };
  let total = 0;
  const parts = {};
  AXES.forEach((axis) => {
    const diff = Math.abs((axesA?.[axis] ?? 1.5) - (axesB?.[axis] ?? 1.5));
    const raw = modes[axis] === 'fixed' ? 25 : 25 - diff * 8.33;
    const score = Math.max(0, Math.min(25, raw));
    parts[axis] = Math.round(score * 10) / 10;
    total += score;
  });
  return { total: Math.max(50, Math.min(100, Math.round(total))), parts };
}
