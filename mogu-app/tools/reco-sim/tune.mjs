// パラメータの自動調整（ランダム探索 → 局所探索）
import fs from 'node:fs';
import { runAll, metrics, objective, BASELINE } from './sim.mjs';
import { DEFAULT_PARAMS } from '../../src/lib/recommend.js';

const SPACE = {
  wTaste: [0.4, 0.6], wBudget: [0.3, 0.55], wQuality: [0, 0.2],
  overPenalty: [0.3, 0.6], underPenalty: [0.05, 0.35],
  hardOverLevels: [0.75, 1.0], unknownPriceShrink: [0, 0.5],
  alpha: [0.4, 0.75], nfBoost: [0, 0.1], plBoost: [0, 0.1], diversityLambda: [0, 0.2],
};
const rng = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); })();

function evaluate(P) {
  let J = 0;
  const per = {};
  for (const [persona, w] of [['moderate', 0.6], ['extreme', 0.2], ['borderline', 0.2]]) {
    const m = metrics(runAll(P, { persona }), P);
    // 好みがほぼ同じ境界ユーザー同士は同じ店になって当然なので、偏りの減点をしない
    if (persona === 'borderline') { m.topShopShare = 0; m.nearDuplicateLists = 0; }
    per[persona] = m;
    J += w * objective(m);
  }
  return { J, per };
}

const sample = () => Object.fromEntries(Object.entries(SPACE).map(([k, [lo, hi]]) => [k, lo + (hi - lo) * rng()]));
const base = { ...DEFAULT_PARAMS, qualityByTaste: true };

let best = { J: -Infinity };
const t0 = Date.now();
const RANDOM = Number(process.argv[2] || 600), LOCAL = Number(process.argv[3] || 300);
for (let i = 0; i < RANDOM; i++) {
  const P = { ...base, ...sample() };
  const r = evaluate(P);
  if (r.J > best.J) best = { ...r, P };
}
for (let i = 0; i < LOCAL; i++) {
  const P = { ...best.P };
  for (const [k, [lo, hi]] of Object.entries(SPACE)) {
    if (rng() < 0.4) P[k] = Math.min(hi, Math.max(lo, P[k] + (rng() - 0.5) * (hi - lo) * 0.2));
  }
  const r = evaluate(P);
  if (r.J > best.J) best = { ...r, P };
}
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v]));
const baseEval = evaluate(BASELINE);
const out = {
  seconds: (Date.now() - t0) / 1000,
  baseline: { J: baseEval.J, moderate: round(baseEval.per.moderate) },
  best: { J: best.J, params: round(best.P), moderate: round(best.per.moderate), extreme: round(best.per.extreme), borderline: round(best.per.borderline) },
};
fs.writeFileSync(new URL('./tuned.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
