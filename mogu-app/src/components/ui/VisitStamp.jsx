import { color, groupColor, groupOf } from '../../theme/tokens';
import { STAMP_ART, STAMP_GRAIN, stampName } from '../../lib/visitStamp';

// =============================================================
// 来店スタンプ（確定版 Final-22・Final-03-StampBook）
//   駅スタンプの形：100×112 の中に、角の丸い二重の四角（外3・内1）、
//   四すみの小さな丸、仕切りの線、下に店名（支店名は入れない）と「2026.11.9」。
//   絵（キャラの頭から胸）は素材 stamp-<コード>.webp をそのまま置く。
//   色はそのキャラのグループの濃い色1色。かすれを同じようにかけ、少し傾ける。
//   「来店記念」の帯はない。
//   大きさは横はばで指定する（高さは 112/100 倍）。確定版は 34・40・50・54・84・96・118・128・130・150。
// =============================================================

const RATIO = 112 / 100;

export default function VisitStamp({ code, name, date, size = 96, tilt = -6, style }) {
  // 色はそのキャラのグループの濃い色1色
  const ink = groupColor[groupOf(code)]?.dark || color.ink;
  const art = STAMP_ART[code];
  const shown = stampName(name);
  const h = Math.round(size * RATIO);

  return (
    <span
      role="img"
      aria-label={`来店スタンプ ${date || ''} ${shown}`.trim()}
      style={{
        position: 'relative',
        flex: 'none',
        display: 'inline-block',
        width: size,
        height: h,
        transform: `rotate(${tilt}deg)`,
        // かすれ。素材は透明度のマスクなので、スタンプぜんたいに同じようにかける
        ...(STAMP_GRAIN
          ? {
            WebkitMaskImage: `url(${STAMP_GRAIN})`,
            maskImage: `url(${STAMP_GRAIN})`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
          }
          : null),
        ...style,
      }}
    >
      {art && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: '14%', top: '8.93%', width: '72%', height: '58.93%', borderRadius: 5, background: `url(${art}) center/cover no-repeat` }}
        />
      )}
      <svg viewBox="0 0 100 112" width={size} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <rect x="2" y="2" width="96" height="108" rx="10" fill="none" stroke={ink} strokeWidth="3" />
        <rect x="6.5" y="6.5" width="87" height="99" rx="7" fill="none" stroke={ink} strokeWidth="1" />
        <line x1="12" y1="81" x2="88" y2="81" stroke={ink} strokeWidth="1" />
        {shown && (
          <text x="50" y="91.6" textAnchor="middle" fontFamily="'IBM Plex Sans JP', sans-serif" fontWeight="700" fontSize="8.2" fill={ink}>
            {shown}
          </text>
        )}
        {date && (
          <text x="50" y="102.6" textAnchor="middle" fontFamily="Dela Gothic One" fontSize="9" fill={ink}>
            {date}
          </text>
        )}
        <circle cx="10.5" cy="10.5" r="1.4" fill={ink} />
        <circle cx="89.5" cy="10.5" r="1.4" fill={ink} />
        <circle cx="10.5" cy="77" r="1.4" fill={ink} />
        <circle cx="89.5" cy="77" r="1.4" fill={ink} />
      </svg>
    </span>
  );
}
