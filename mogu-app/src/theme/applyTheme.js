// tokens.js の値を CSS の変数として :root に入れる。
// 押したときの色（:active）や動きは CSS でしか書けないため、ui.css からはこの変数だけを使う。
// （色の値そのものは tokens.js にだけ書く）
import { color, font } from './tokens';

export function applyTheme() {
  const root = document.documentElement.style;
  const vars = {
    '--c-bg': color.bg,
    '--c-surface': color.surface,
    '--c-surface-pressed': color.surfacePressed,
    '--c-ink': color.ink,
    '--c-ink-pressed': color.inkPressed,
    '--c-sub': color.sub,
    '--c-line': color.line,
    '--c-line-strong': color.lineStrong,
    '--c-accent': color.accent,
    '--c-accent-pressed': color.accentPressed,
    '--c-red': color.red,
    '--c-red-pressed': color.redPressed,
    '--c-red-bg': color.redBg,
    '--c-tab-active': color.tabActive,
    '--c-scrim': color.scrim,
    '--f-dela': font.dela,
    '--f-plex': font.plex,
  };
  Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));
}
