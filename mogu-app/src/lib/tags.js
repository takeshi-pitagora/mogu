// ハッシュタグの決まり（引き渡し書 第5回 §6-7）
//   しきい値は app_settings から来る。ここでは受け取った値で判定するだけ

export const TAG_FONT = { big: 18, mid: 16, small: 14 };

// よく使われるものほど大きく、3段階
//   お店のページ   … count は＋1の数（既定 20以上で大、10以上で中）
//   候補・絞り込み … count は使われているお店の数（既定 90以上で大、50以上で中）
export function tagFontSize(count, { big, mid }) {
  const n = Number(count) || 0;
  if (n >= big) return TAG_FONT.big;
  if (n >= mid) return TAG_FONT.mid;
  return TAG_FONT.small;
}

// 新しいタグに使える名前か（§6-7）
//   2〜15文字。空白・記号は使えない（「ー」「・」「&」は使える）
const ALLOWED = /^[0-9A-Za-zぁ-ゖァ-ヺ一-龯々〆ー・&]+$/u;

export function tagNameError(name) {
  const t = String(name || '').trim().replace(/^#/, '');
  if (t.length < 2) return 'tooShort';
  if (t.length > 15) return 'tooLong';
  if (!ALLOWED.test(t)) return 'format';
  return null;
}
