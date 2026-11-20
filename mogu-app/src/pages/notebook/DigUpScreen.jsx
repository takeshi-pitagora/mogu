import { useEffect, useState } from 'react';
import { color, font } from '../../theme/tokens';

// =============================================================
// ㉖-17〜20 dig が上がったとき。黒い全画面に数だけ。説明の文は入れない
//   1 いまの dig が大きく → 2 小さくなって上へ、新しい dig が下から出る →
//   3 上に小さく前の dig・下向きの矢印・大きな新しい dig と放射の線・［閉じる］
//   3けたでも同じ並び
// =============================================================

// 放射の線（長さと角度は決め打ちで、毎回同じに見えるように）
const RAYS = Array.from({ length: 16 }, (_, i) => ({
  a: (i * 360) / 16 + (i % 2 ? 6 : -4),
  len: i % 3 === 0 ? 46 : 30,
  c: i % 2 ? '#C08268' : '#FFFFFF',
  r: i % 4 === 0 ? 146 : 132,
}));

export default function DigUpScreen({ from, to, onClose }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const a = setTimeout(() => setStep(2), 900);
    const b = setTimeout(() => setStep(3), 1650);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const big = (n, size) => (
    <span aria-label={`Dig ${n}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, color: color.white, whiteSpace: 'nowrap', lineHeight: 1, transform: 'skewX(-12deg)' }}>
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.02em' }}>dig</span>
      <span style={{ fontFamily: font.dela, fontSize: Math.round(size * 1.26) }}>{n}</span>
    </span>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: color.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 120, boxSizing: 'border-box', fontFamily: font.plex }}>
      {/* 前の dig：1では大きく真ん中、2・3では小さく上に */}
      <div style={{ opacity: step === 1 ? 1 : 0.55, transform: step === 1 ? 'translateY(60px) scale(1)' : 'translateY(0) scale(1)', transition: 'transform 0.5s ease-out, opacity 0.5s ease-out', filter: step === 1 ? 'none' : 'grayscale(1)' }}>
        {big(from, step === 1 ? 56 : 24)}
      </div>

      {step >= 3 && (
        <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true" style={{ marginTop: 10 }}>
          <path d="M11 2v22M3.5 17 11 25l7.5-8" fill="none" stroke="#C08268" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {step >= 2 && (
        <div style={{ position: 'relative', marginTop: step >= 3 ? 26 : 18, opacity: 1, transform: step >= 3 ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.9)', transition: 'transform 0.55s cubic-bezier(.2,.9,.3,1.2)' }}>
          {step >= 3 && RAYS.map((r) => (
            <span
              key={r.a}
              aria-hidden="true"
              className="mogu-ray"
              style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: r.len, marginLeft: -2, borderRadius: 2, background: r.c, transform: `rotate(${r.a}deg) translateY(-${r.r}px)`, transformOrigin: 'center center', animation: 'mogu-ray 0.5s ease-out' }}
            />
          ))}
          <span style={{ position: 'relative' }}>{big(to, 72)}</span>
        </div>
      )}

      {step >= 3 && (
        <button
          type="button"
          onClick={onClose}
          className="ui-btn"
          style={{ position: 'absolute', left: '50%', width: 240, marginLeft: -120, bottom: 'calc(70px + var(--safe-bottom, 0px))', height: 56, border: 0, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
        >
          閉じる
        </button>
      )}
    </div>
  );
}
