import { color, groupColor, groupOf } from '../../theme/tokens';
import { STAMP_ART, STAMP_GRAIN, stampName } from '../../lib/visitStamp';

// =============================================================
// 来店スタンプ（§4）
//   駅スタンプの形：角の丸い二重の四角に、キャラの頭から胸（素材の stamp-<コード>.webp）、
//   下に店名（支店名は入れない。長いときは幅を詰めて1行）と「2026.11.9」。
//   色はそのキャラのグループの濃い色1色。かすれを同じようにかけ、少し傾ける。
//   「来店記念」の帯はない。大きさは 34・54・96・128・150。
//   絵は渡された画像をそのまま使う（描き直さない・色や表情を変えない）。
// =============================================================

const SIZES = {
  34: { radius: 6, pad: 2, gap: 0, name: 4, date: 6, inner: 2 },
  54: { radius: 9, pad: 3, gap: 1, name: 6, date: 8, inner: 2 },
  96: { radius: 15, pad: 6, gap: 2, name: 9, date: 13, inner: 3 },
  128: { radius: 20, pad: 8, gap: 2, name: 11, date: 17, inner: 3 },
  150: { radius: 24, pad: 9, gap: 3, name: 13, date: 20, inner: 4 },
};

export default function VisitStamp({ code, name, date, size = 96, tilt = -4, style }) {
  const s = SIZES[size] || SIZES[96];
  // 色はそのキャラのグループの濃い色1色（§4）
  const ink = groupColor[groupOf(code)]?.dark || color.ink;
  const art = STAMP_ART[code];
  const shown = stampName(name);

  return (
    <span
      role="img"
      aria-label={`${shown}の来店スタンプ ${date || ''}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flex: 'none',
        transform: `rotate(${tilt}deg)`,
        // かすれ（§4）。素材は透明度のマスクなので、スタンプぜんたいに同じようにかける
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
      {/* 角の丸い二重の四角 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          border: `${Math.max(2, Math.round(size / 36))}px solid ${ink}`,
          borderRadius: s.radius,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: s.inner,
          border: `${Math.max(1, Math.round(size / 72))}px solid ${ink}`,
          borderRadius: Math.max(2, s.radius - s.inner),
        }}
      />

      <span
        style={{
          position: 'absolute',
          inset: s.pad + s.inner,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: s.gap,
        }}
      >
        {art && (
          <img
            src={art}
            alt=""
            style={{ flex: 1, minHeight: 0, width: '100%', display: 'block', objectFit: 'contain', objectPosition: 'center bottom' }}
          />
        )}
        {shown && (
          <span
            style={{
              maxWidth: '100%',
              color: ink,
              fontFamily: "'Shippori Mincho B1', 'Hiragino Mincho ProN', serif",
              fontSize: s.name,
              fontWeight: 800,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'clip',
              transform: 'scaleX(1)',
              transformOrigin: 'center',
            }}
          >
            {shown}
          </span>
        )}
        {date && (
          <span
            style={{
              color: ink,
              fontFamily: "'Fraunces', 'Hiragino Mincho ProN', serif",
              fontSize: s.date,
              fontWeight: 700,
              fontStyle: 'italic',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {date}
          </span>
        )}
      </span>

    </span>
  );
}
