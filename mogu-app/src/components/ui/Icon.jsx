import { ICONS } from './icons';
import { stroke } from '../../theme/tokens';

// 確定版のアイコン（線 2.75・角はとがらせる・線の端は四角）。形は icons.js のまま使う
// name: icons.js のキー / size: 表示の大きさ / strokeWidth: 確定版でその場所だけ細い・太いときに指定
export default function Icon({ name, size = 24, strokeWidth, color = 'currentColor', label, style }) {
  const ic = ICONS[name];
  if (!ic) return null;
  const isFill = ic.kind === 'fill';
  const sw = strokeWidth ?? (isFill ? ic.sw || 0 : ic.sw || stroke.icon);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFill ? color : 'none'}
      stroke={sw ? color : 'none'}
      strokeWidth={sw || undefined}
      strokeLinejoin="miter"
      strokeLinecap="square"
      fillRule={ic.evenodd ? 'evenodd' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: 'none', display: 'block', ...style }}
    >
      <path d={ic.d} />
    </svg>
  );
}
