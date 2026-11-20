import { color, font } from '../../theme/tokens';

// =============================================================
// dig のしるし（確定版 Final-03-Profile・Final-26）
//   「dig」は IBM Plex 700、数は Dela Gothic One。少し斜めにする。
//   size は「dig」の字の大きさ。数はその 1.26 倍。
//   outline を立てると、写真の上でも読めるように白いふちが付く。
// =============================================================

const OUTLINE = '2px 0 #FFFFFF, -2px 0 #FFFFFF, 0 2px #FFFFFF, 0 -2px #FFFFFF, 1.5px 1.5px #FFFFFF, -1.5px -1.5px #FFFFFF, 1.5px -1.5px #FFFFFF, -1.5px 1.5px #FFFFFF, 2.5px 0 #FFFFFF, -2.5px 0 #FFFFFF';

export default function Dig({ n = 1, size = 15.5, outline = false, muted = false, style }) {
  return (
    <span
      aria-label={`Dig ${n}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 1,
        color: color.ink,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        transform: 'skewX(-12deg)',
        ...(outline ? { textShadow: OUTLINE } : null),
        ...(muted ? { opacity: 0.45 } : null),
        ...style,
      }}
    >
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em' }}>dig</span>
      <span style={{ fontFamily: font.dela, fontSize: Math.round(size * 1.26 * 10) / 10 }}>{n}</span>
    </span>
  );
}
