// mogu のロゴ（けんとから受け取った画像のまま）
import logoBlack from '../assets/brand/mogu_logo_black.png';
import logoWhite from '../assets/brand/mogu_logo_white.png';
import nozokuBlack from '../assets/brand/mogu_nozoku_logo_black.png';
import nozokuWhite from '../assets/brand/mogu_nozoku_logo_white.png';
import logoOutline from '../assets/brand/mogu_logo_outline.png';

export const LOGO = { black: logoBlack, white: logoWhite }; // 「Mogu」の切り出し（2060×750）
export const NOZOKU_LOGO = { black: nozokuBlack, white: nozokuWhite }; // 虫めがねでのぞくロゴ（1985×820）
export const LOGO_OUTLINE = logoOutline; // ロゴのふちだけ（⑪QRコードの背景。確定版から）
export const LOGO_RATIO = 750 / 2060;
export const NOZOKU_RATIO = 820 / 1985;
