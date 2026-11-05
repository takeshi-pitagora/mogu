// =============================================================
// 新しいモグキャラ16体の画像（MoguType_character_images.zip のまま。描き直し・加工はしない）
//   display: 640×960（プロフィール・シートの右上のキャラ・空の画面など）
//   thumb:   168×252（一覧・小さい表示）
//   framed:  display を16体すべて同じ枠（全員の絵が入るいちばん小さい枠 31,38〜609,922）で切り出したもの。
//            確定版の見本のキャラ画像と同じ切り出し方（縮尺と足もとの高さは16体でそろったまま）。
//            シートの右上・空の画面・プロフィールなど、確定版でキャラを枠に入れて見せる所はこれを使う
// キャラ名は mogutype.js の TYPES（mogutype.com と同じ）を使う
// =============================================================
import { TYPES } from './mogutype';

const displays = import.meta.glob('../assets/chara/display/*.webp', { eager: true, import: 'default' });
const thumbs = import.meta.glob('../assets/chara/thumbs/*.webp', { eager: true, import: 'default' });
const framed = import.meta.glob('../assets/chara/framed/*.webp', { eager: true, import: 'default' });

const pick = (files, re) => {
  const out = {};
  Object.entries(files).forEach(([path, url]) => {
    const m = path.match(re);
    if (m) out[m[1]] = url;
  });
  return out;
};

const DISPLAY = pick(displays, /mogu-([A-Z]{4})\.webp$/);
const THUMB = pick(thumbs, /\/([A-Z]{4})\.webp$/);
const FRAMED = pick(framed, /\/([A-Z]{4})\.webp$/);

export function chara(code) {
  const c = String(code || '').toUpperCase();
  if (!DISPLAY[c]) return null;
  return { code: c, name: TYPES[c]?.name || '', display: DISPLAY[c], thumb: THUMB[c], framed: FRAMED[c] };
}

// 案内役のキャラ（引き渡し書 §4・画面ごとの仕様）
export const GUIDE = {
  harry: 'TNGL', // 探偵ハリー：確認の画面・空の画面・読み込み中・通信できない
  kitsune: 'VNBP', // 映えぎつね：ゲストの登録の案内
  kawauso: 'TFBL', // 夜食カワウソ：通知の許可のお願い
};
