// =============================================================
// 来店スタンプの決まり（§4）。絵は components/ui/VisitStamp.jsx が出す
// =============================================================
import { TYPES } from './mogutype';

const stamps = import.meta.glob('../assets/stamp/stamp-*.webp', { eager: true, import: 'default' });
const grainFiles = import.meta.glob('../assets/stamp/stamp-grain-mask.png', { eager: true, import: 'default' });

export const STAMP_ART = {};
Object.entries(stamps).forEach(([path, url]) => {
  const m = path.match(/stamp-([A-Z]{4})\.webp$/);
  if (m) STAMP_ART[m[1]] = url;
});
export const STAMP_GRAIN = Object.values(grainFiles)[0];
export const STAMP_CODES = Object.keys(STAMP_ART).sort();

// ㉒-8 キャラは押すたびに16体から同じ確率でランダムに1体
//   （自分のモグタイプや未診断かどうかには関係ない）。えらぶのはサーバー。
export function randomStampCode() {
  const codes = STAMP_CODES.length > 0 ? STAMP_CODES : Object.keys(TYPES);
  return codes[Math.floor(Math.random() * codes.length)];
}

// 店名から支店名を落とす（「サンプル食堂 渋谷店」なら「サンプル食堂」）
export function stampName(name) {
  const t = String(name || '').trim();
  const cut = t.replace(/[\s\u3000][^\s\u3000]{1,8}\u5e97$/u, '').replace(/[^\s\u3000]{1,6}\u5e97$/u, '');
  return cut || t;
}

// 2026.11.9
export function stampDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
