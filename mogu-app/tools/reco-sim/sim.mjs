// 16×16 タイプの全組み合わせでレコメンドを実行し、品質指標を計測する
import fs from 'node:fs';
import {
  DEFAULT_PARAMS, recommend, shopFeatures, normalizeAxes, axesFromTypeCode,
  personFit, preferredPriceLevel,
} from '../../src/lib/recommend.js';

export const corpus = JSON.parse(fs.readFileSync(new URL('./corpus.json', import.meta.url)));

export const TYPES = ['VNBP','VNBL','VNGP','VNGL','VFBP','VFBL','VFGP','VFGL','TNBP','TNBL','TNGP','TNGL','TFBP','TFBL','TFGP','TFGL'];
export const NAMES = { VNBP:'映えぎつね', VNBL:'ドパねこ', VNGP:'DJレッサー', VNGL:'VLOGうさぎ', VFBP:'スケボードッグ', VFBL:'ジジふくろう', VFGP:'アロハコアラ', VFGL:'貴族ペンギン', TNBP:'ブタ上等', TNBL:'GOGOビーバー', TNGP:'スパイス狼', TNGL:'探偵ハリー', TFBP:'常連ベアー', TFBL:'夜食カワウソ', TFGP:'鍋カピ', TFGL:'皇帝ライオン' };

// 最初に提案した素朴な式（比較用のベースライン）
export const BASELINE = {
  ...DEFAULT_PARAMS,
  wTaste: 0.5, wBudget: 0.5, wQuality: 0, qualityByTaste: false,
  overPenalty: 1 / 3, underPenalty: 1 / 3, hardOverLevels: 2, unknownPriceShrink: 0,
  alpha: 0.6, nfBoost: 0.05, plBoost: 0.05, diversityLambda: 0,
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function corr(x, y) {
  const mx = mean(x), my = mean(y);
  let n = 0, dx = 0, dy = 0;
  x.forEach((v, i) => { n += (v - mx) * (y[i] - my); dx += (v - mx) ** 2; dy += (y[i] - my) ** 2; });
  return dx && dy ? n / Math.sqrt(dx * dy) : 0;
}

// persona: 'moderate'（0.75/2.25）, 'extreme'（0/3）, 'borderline'（1.35/1.65）
export function personaAxes(code, persona = 'moderate') {
  const vals = { moderate: [0.75, 2.25], extreme: [0, 3], borderline: [1.35, 1.65] }[persona];
  return axesFromTypeCode(code, { typeLeftValue: vals[0], typeRightValue: vals[1] });
}

export function runAll(params, { persona = 'moderate', topN = 5 } = {}) {
  const pairs = [];
  for (let i = 0; i < TYPES.length; i++) {
    for (let j = i; j < TYPES.length; j++) {
      const a = TYPES[i], b = TYPES[j];
      const members = [{ axes: personaAxes(a, persona) }, { axes: personaAxes(b, persona) }];
      const recs = recommend(members, corpus, { limit: topN, params });
      pairs.push({ a, b, members, recs });
    }
  }
  return pairs;
}

export function metrics(pairs, params) {
  let slots = 0, budgetViol = 0, misery = 0, gaps = [], divs = [], percents = [];
  const pairVt = [], recVt = [], pairBg = [], recPrice = [];
  const noveltyNN = [], noveltyFF = [], bookPP = [], bookLL = [];
  const shopCount = {};
  const emptyPairs = [];
  for (const p of pairs) {
    const users = p.members.map((m) => normalizeAxes(m.axes));
    if (p.recs.length < 5) emptyPairs.push(`${p.a}×${p.b}`);
    const genres = new Set();
    for (const r of p.recs) {
      slots++;
      const s = r.features;
      const fits = users.map((u) => personFit(u, s, params).score);
      const prefs = users.map(preferredPriceLevel);
      if (prefs.some((pf) => s.priceLevel > pf + 1.0001)) budgetViol++;
      if (Math.min(...fits) < 0.7) misery++;
      gaps.push(Math.abs(fits[0] - fits[1]));
      genres.add(s.genreKey);
      percents.push(r.percent);
      shopCount[r.restaurant.id] = (shopCount[r.restaurant.id] || 0) + 1;
    }
    divs.push(genres.size);
    pairVt.push(mean(users.map((u) => u.vt)));
    recVt.push(mean(p.recs.map((r) => r.features.vt)));
    pairBg.push(mean(users.map((u) => u.bg)));
    recPrice.push(mean(p.recs.map((r) => r.features.priceLevel)));
    const nov = mean(p.recs.map((r) => r.features.novelty));
    const book = mean(p.recs.map((r) => r.features.bookable));
    if (p.a[1] === 'N' && p.b[1] === 'N') noveltyNN.push(nov);
    if (p.a[1] === 'F' && p.b[1] === 'F') noveltyFF.push(nov);
    if (p.a[3] === 'P' && p.b[3] === 'P') bookPP.push(book);
    if (p.a[3] === 'L' && p.b[3] === 'L') bookLL.push(book);
  }
  const counts = Object.values(shopCount).sort((x, y) => y - x);
  // 組み合わせが違うのに同じ上位5店になってしまう割合（VTかBGが違うペア同士）
  let sameList = 0, cmp = 0;
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const A = pairs[i], B = pairs[j];
    const keyA = [A.a[0] + A.a[2], A.b[0] + A.b[2]].sort().join();
    const keyB = [B.a[0] + B.a[2], B.b[0] + B.b[2]].sort().join();
    if (keyA === keyB) continue;
    cmp++;
    const sa = new Set(A.recs.map((r) => r.restaurant.id));
    const inter = B.recs.filter((r) => sa.has(r.restaurant.id)).length;
    if (inter >= 4) sameList++;
  }
  return {
    budgetViolationRate: budgetViol / slots,
    miseryRate: misery / slots,
    fairnessGap: mean(gaps),
    genreDiversity: mean(divs),
    vtResponsiveness: corr(pairVt, recVt),
    budgetResponsiveness: corr(pairBg, recPrice),
    nfEffect: mean(noveltyNN) - mean(noveltyFF),
    plEffect: mean(bookPP) - mean(bookLL),
    topShopShare: counts[0] / pairs.length,
    shopsUsed: counts.length,
    nearDuplicateLists: sameList / cmp,
    avgPercent: mean(percents),
    emptyPairs: emptyPairs.length,
  };
}

export function objective(m) {
  if (m.budgetViolationRate > 0 || m.emptyPairs > 0) return -100 + -m.budgetViolationRate * 100 - m.emptyPairs;
  return (
    3 * (1 - m.miseryRate) -
    3 * m.fairnessGap +
    0.6 * Math.min(m.genreDiversity, 4) / 4 +
    1.2 * m.vtResponsiveness +
    1.2 * m.budgetResponsiveness +
    1.5 * Math.min(Math.max(m.nfEffect, 0), 0.2) / 0.2 +
    1.0 * Math.min(Math.max(m.plEffect, 0), 0.2) / 0.2 -
    1.0 * m.topShopShare -
    1.0 * m.nearDuplicateLists
  );
}

// 直接実行: ベースラインと現在の DEFAULT_PARAMS を比較
if (process.argv[1] === new URL(import.meta.url).pathname) {
  for (const [label, P] of [['baseline', BASELINE], ['default', DEFAULT_PARAMS]]) {
    const m = metrics(runAll(P), P);
    console.log(label, JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))), 'J=', objective(m).toFixed(3));
  }
}
