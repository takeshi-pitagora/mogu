import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, TYPES, AXES, calculateDiagnosis, getType } from '../src/lib/mogutype.js';
import fs from 'node:fs';
// avatars.js は画像を import するため（Vite専用）、ファイルの存在で確認する
const avatarExists = (id) => fs.existsSync(new URL(`../src/assets/avatars/${id}.png`, import.meta.url));

const answerAll = (byAxis) => Object.fromEntries(QUESTIONS.map((q) => [q.id, byAxis[q.axis]]));

test('20問・各軸5問', () => {
  assert.equal(QUESTIONS.length, 20);
  for (const a of AXES) assert.equal(QUESTIONS.filter((q) => q.axis === a.key).length, 5);
});

test('採点は mogutype.com と同じ（平均1.5未満で左の文字）', () => {
  assert.equal(calculateDiagnosis(answerAll({ VT: 0, NF: 0, BG: 0, PL: 0 })).code, 'VNBP');
  assert.equal(calculateDiagnosis(answerAll({ VT: 3, NF: 3, BG: 3, PL: 3 })).code, 'TFGL');
  assert.equal(calculateDiagnosis(answerAll({ VT: 1, NF: 2, BG: 1, PL: 2 })).code, 'VFBL');
  // ちょうど1.5は右
  const ans = answerAll({ VT: 0, NF: 0, BG: 0, PL: 0 });
  ['V-01', 'V-08', 'V-10'].forEach((id) => { ans[id] = 2; });
  ['V-17', 'V-18'].forEach((id) => { ans[id] = 1; }); // 平均 (2+2+2+1+1)/5 = 1.6
  assert.equal(calculateDiagnosis(ans).code[0], 'T');
  assert.equal(calculateDiagnosis(ans).axes.VT, 1.6);
});

test('未回答の軸があると結果を出さない', () => {
  assert.equal(calculateDiagnosis({}), null);
});

test('16タイプすべてに、重複しないキャラ画像が割り当てられている', () => {
  const ids = Object.values(TYPES).map((t) => t.avatarId);
  assert.equal(Object.keys(TYPES).length, 16);
  assert.equal(new Set(ids).size, 16);
  for (const id of ids) assert.ok(avatarExists(id), id);
});

test('getType は保存値（タイプコード）から取り出し、未診断は null', () => {
  assert.equal(getType('tngl').name, '探偵ハリー');
  assert.equal(getType('未診断'), null);
});
