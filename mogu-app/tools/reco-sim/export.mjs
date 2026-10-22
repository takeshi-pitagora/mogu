// レポート用に、全組み合わせの推薦結果と指標を書き出す
import fs from 'node:fs';
import { runAll, metrics, BASELINE, TYPES, NAMES } from './sim.mjs';
import { DEFAULT_PARAMS, pairCompatibility, axesFromTypeCode } from '../../src/lib/recommend.js';
const slim = (pairs) => Object.fromEntries(pairs.map((p) => [`${p.a}|${p.b}`, p.recs.map((r) => ({
  n: r.restaurant.name, t: r.restaurant.synthetic ? 1 : 0, g: r.features.genreLabel, lv: r.features.priceLevel,
  k: r.features.priceKnown ? 1 : 0, pct: r.percent, why: r.reason, f: r.memberFits,
}))]));
const round = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
const out = { types: TYPES, names: NAMES, params: DEFAULT_PARAMS, compat: {}, base: slim(runAll(BASELINE)), final: slim(runAll(DEFAULT_PARAMS)), metrics: {} };
for (const persona of ['moderate', 'extreme', 'borderline']) {
  out.metrics[persona] = { base: round(metrics(runAll(BASELINE, { persona }), BASELINE)), final: round(metrics(runAll(DEFAULT_PARAMS, { persona }), DEFAULT_PARAMS)) };
}
for (const a of TYPES) for (const b of TYPES) out.compat[`${a}|${b}`] = pairCompatibility(axesFromTypeCode(a), axesFromTypeCode(b)).total;
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log('pairs', Object.keys(out.final).length, 'bytes', fs.statSync(process.argv[2]).size);
console.log(JSON.stringify(out.metrics.moderate));
