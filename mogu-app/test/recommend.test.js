// npm test で実行（追加の依存なし）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recommend, shopFeatures, normalizeAxes, axesFromTypeCode, personFit,
  preferredPriceLevel, pairCompatibility, toPercent, DEFAULT_PARAMS,
} from '../src/lib/recommend.js';

const shop = (o) => ({ name: 'テスト店', genre: 'レストラン', price_level: 2, rating: 4.0, user_ratings_total: 100, ...o });
const SHOPS = [
  shop({ id: 1, name: 'おしゃれテラスカフェ', genre: 'カフェ', price_level: 2 }),
  shop({ id: 2, name: 'パフェ専門店', genre: 'スイーツ', price_level: 2 }),
  shop({ id: 3, name: '家系ラーメン', genre: 'ラーメン', price_level: 1, user_ratings_total: 2000 }),
  shop({ id: 4, name: '定食屋', genre: '定食', price_level: 1, user_ratings_total: 800 }),
  shop({ id: 5, name: '夜景フレンチ', genre: 'フレンチ', price_level: 4, rating: 4.6, user_ratings_total: 120 }),
  shop({ id: 6, name: '炭火焼肉', genre: '焼肉', price_level: 3, rating: 4.4 }),
  shop({ id: 7, name: 'スパイスカレー', genre: 'エスニック', price_level: 2, user_ratings_total: 20 }),
  shop({ id: 8, name: '鮨 名店', genre: '寿司', price_level: 4, rating: 4.7, user_ratings_total: 300 }),
  shop({ id: 9, name: 'ワインバル', genre: 'ワインバー', price_level: 3, user_ratings_total: 40 }),
  shop({ id: 10, name: '町中華', genre: '中華', price_level: 2, user_ratings_total: 500 }),
  shop({ id: 11, name: 'ハンバーガー', genre: 'ハンバーガー', price_level: 2 }),
  shop({ id: 12, name: '価格不明のビストロ', genre: 'ビストロ', price_level: null }),
];
const TYPES = ['VNBP','VNBL','VNGP','VNGL','VFBP','VFBL','VFGP','VFGL','TNBP','TNBL','TNGP','TNGL','TFBP','TFBL','TFGP','TFGL'];

test('ジャンル判定: ハンバーガーはバーにならない／レストランはお店扱い', () => {
  assert.equal(shopFeatures(shop({ genre: 'ハンバーガー' })).genreKey, 'burger');
  assert.equal(shopFeatures(shop({ genre: 'バー' })).genreKey, 'bar');
  assert.equal(shopFeatures(shop({ genre: 'レストラン' })).genreKey, 'other');
});

test('見た目派はカフェ、味覚派はラーメンの相性が高い', () => {
  const V = normalizeAxes(axesFromTypeCode('VNGP'));
  const T = normalizeAxes(axesFromTypeCode('TNGP'));
  const cafe = shopFeatures(SHOPS[0]);
  const ramen = shopFeatures(SHOPS[2]);
  assert.ok(personFit(V, cafe).taste > personFit(V, ramen).taste);
  assert.ok(personFit(T, ramen).taste > personFit(T, cafe).taste);
});

test('全256通りで、誰かの予算を1段階以上超える店は出ない', () => {
  for (const a of TYPES) for (const b of TYPES) {
    const members = [{ type: a }, { type: b }];
    const users = members.map((m) => normalizeAxes(axesFromTypeCode(m.type)));
    for (const r of recommend(members, SHOPS, { limit: 5 })) {
      for (const u of users) assert.ok(r.features.priceLevel <= preferredPriceLevel(u) + 1, `${a}×${b}: ${r.restaurant.name}`);
    }
  }
});

test('A×B と B×A は同じ結果（順番に依存しない）', () => {
  for (const [a, b] of [['VNBP', 'TFGL'], ['VFGP', 'TNBL'], ['TNGP', 'VFBL']]) {
    const ab = recommend([{ type: a }, { type: b }], SHOPS, { limit: 5 }).map((r) => r.restaurant.id);
    const ba = recommend([{ type: b }, { type: a }], SHOPS, { limit: 5 }).map((r) => r.restaurant.id);
    assert.deepEqual(ab, ba);
  }
});

test('コスパ派同士には高級店が出ない／奮発派同士には高級店が上位に入りうる', () => {
  const cheap = recommend([{ type: 'TFBP' }, { type: 'TFBP' }], SHOPS, { limit: 5 });
  assert.ok(cheap.every((r) => r.features.priceLevel <= 2));
  const rich = recommend([{ type: 'TFGP' }, { type: 'TFGP' }], SHOPS, { limit: 5 });
  assert.ok(rich.some((r) => r.features.priceLevel >= 3));
});

test('開拓派同士は行きつけ派同士より、新しい店（口コミが少ない冒険ジャンル）を上に並べる', () => {
  const rankOf = (type) => recommend([{ type }, { type }], SHOPS, { limit: 12 }).findIndex((r) => r.restaurant.id === 7);
  assert.ok(rankOf('TNBL') < rankOf('TFBL'));
});

test('相性%は50〜99に収まり、理由文に「その他」が出ない', () => {
  for (const a of TYPES) for (const b of TYPES) {
    for (const r of recommend([{ type: a }, { type: b }], SHOPS, { limit: 5 })) {
      assert.ok(r.percent >= 50 && r.percent <= 99);
      assert.ok(!r.reason.includes('その他'));
    }
  }
  assert.equal(toPercent(0), 50);
  assert.equal(toPercent(1), 99);
});

test('診断の4軸の点数（0〜3の小数）でもそのまま使える', () => {
  const recs = recommend([{ axes: { VT: 0.4, NF: 1.2, BG: 2.8, PL: 2.0 } }, { axes: { VT: 2.6, NF: 0.5, BG: 2.2, PL: 0.3 } }], SHOPS);
  assert.ok(recs.length > 0);
});

test('2人のタイプ相性は mogutype.com と同じ式', () => {
  assert.equal(pairCompatibility(axesFromTypeCode('VNBP'), axesFromTypeCode('VNBP')).total, 100);
  // VT と BG が 1.5 ずつ違う → 25-12.5 が2軸 + 25×2 = 75
  assert.equal(pairCompatibility(axesFromTypeCode('VNBP'), axesFromTypeCode('TNGP')).total, 75);
  // NF と PL の違いは相性に影響しない
  assert.equal(pairCompatibility(axesFromTypeCode('VNBP'), axesFromTypeCode('VFBL')).total, 100);
});

test('価格不明の店も除外されずに候補に入る', () => {
  const recs = recommend([{ type: 'VNGP' }, { type: 'VFGP' }], SHOPS, { limit: 12 });
  assert.ok(recs.some((r) => r.restaurant.id === 12));
  assert.equal(DEFAULT_PARAMS.hardOverLevels < 1, true);
});
