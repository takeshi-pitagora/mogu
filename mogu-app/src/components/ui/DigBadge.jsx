import { color, font } from '../../theme/tokens';

// dig（確定版 Final-03-Profile・引き渡し書 第5回 §4）
//   「dig」（Plex 太字）＋数字（Dela）、−12度に傾け、文字のまわりに白いふち 2
//   囲い・塗りはなし。写真の右下に重ねる。押せる範囲は 44 以上
//   3けた（dig128）でも崩れない（折り返さない）
//
//   自分の dig は押すと探検手帳（㉖）。ほかの人の dig は見るだけ（③-11）
const WHITE_EDGE = [
  '2px 0 #FFFFFF',
  '-2px 0 #FFFFFF',
  '0 2px #FFFFFF',
  '0 -2px #FFFFFF',
  '1.5px 1.5px #FFFFFF',
  '-1.5px -1.5px #FFFFFF',
  '1.5px -1.5px #FFFFFF',
  '-1.5px 1.5px #FFFFFF',
  '2.5px 0 #FFFFFF',
  '-2.5px 0 #FFFFFF',
].join(', ');

function DigText({ value }) {
  return (
    <span
      aria-label={`Dig ${value}`}
      style={{
        textShadow: WHITE_EDGE,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 1,
        color: color.ink,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        transform: 'skewX(-12deg)',
      }}
    >
      <span style={{ fontSize: 14.6, fontWeight: 700, letterSpacing: '-0.02em' }}>dig</span>
      <span style={{ fontFamily: font.dela, fontSize: 18.4 }}>{value}</span>
    </span>
  );
}

export default function DigBadge({ value = 1, onClick, overlay = true, style }) {
  // overlay = 写真の右下に重ねる形。false なら文字だけ（㉑の「見つけた人」の行など）
  const box = overlay
    ? {
        position: 'absolute',
        right: -14,
        bottom: -12,
        minWidth: 52,
        minHeight: 44,
        boxSizing: 'border-box',
        padding: '0 4px 10px 0',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
      }
    : { display: 'inline-flex', alignItems: 'center' };

  if (!onClick) {
    return (
      <span style={{ ...box, color: color.ink, ...style }}>
        <DigText value={value} />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`dig${value}（押すと探検手帳）`}
      onClick={onClick}
      className="ui-btn"
      style={{ ...box, border: 0, background: 'transparent', color: color.ink, ...style }}
    >
      <DigText value={value} />
    </button>
  );
}
