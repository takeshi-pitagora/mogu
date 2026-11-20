import { useEffect, useState } from 'react';
import { color, font } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import MoguCoin from '../../components/ui/MoguCoin';
import { shopPhotoUrl } from '../../lib/shops';

// =============================================================
// ⑳-8〜12 コインが確定した／取り消された知らせ
//   黒い地にコインが回りながら出てきて止まり、「＋10」と
//   「モグコイン 128 → 138」。コインの数を見るのは探検手帳だけなので、
//   ここは「いま増えた分」を見せるための画面
//   金色・メダル・紙吹雪は使わない（引き渡し書 §4）
// =============================================================

export default function CoinConfirmScreen({ amount, shopName, shopPhoto, note, from, to, cancelled = false, onOpenShop, onClose }) {
  const [spin, setSpin] = useState(true);
  const [n, setN] = useState(from);

  useEffect(() => {
    const a = setTimeout(() => setSpin(false), 900);
    return () => clearTimeout(a);
  }, []);

  // 止まったら数を 128 → 138 に送る
  useEffect(() => {
    if (spin) return undefined;
    const step = Math.max(1, Math.round(Math.abs(to - from) / 12));
    const dir = to > from ? 1 : -1;
    const t = setInterval(() => {
      setN((v) => {
        const next = v + dir * step;
        if ((dir > 0 && next >= to) || (dir < 0 && next <= to)) {
          clearInterval(t);
          return to;
        }
        return next;
      });
    }, 40);
    return () => clearInterval(t);
  }, [spin, from, to]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: color.ink, color: color.white, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'calc(54px + var(--safe-top, 0px)) 20px calc(30px + var(--safe-bottom, 0px))', boxSizing: 'border-box', fontFamily: font.plex }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, border: 0, background: 'transparent', color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={24} color={color.white} strokeWidth={2.75} />
        </button>
      </div>

      <div style={{ marginTop: 22, fontSize: 15, fontWeight: 700, color: '#E3DED6', visibility: spin ? 'hidden' : 'visible' }}>
        {cancelled ? 'コインが取り消されました' : 'コインが確定しました'}
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!spin && (
            <>
              <span aria-hidden="true" style={{ position: 'absolute', inset: -26, border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '50%' }} />
              <span aria-hidden="true" style={{ position: 'absolute', inset: -6, border: '1.5px solid rgba(255,255,255,0.18)', borderRadius: '50%' }} />
            </>
          )}
          <span style={{ display: 'block', transform: spin ? 'scaleX(.22)' : 'scaleX(1)', transition: 'transform 0.55s cubic-bezier(.2,.9,.3,1.1)' }}>
            <MoguCoin size={spin ? 120 : 240} state={cancelled ? 'cancelled' : 'confirmed'} />
          </span>
        </div>
      </div>

      <div style={{ marginTop: 26, fontFamily: font.dela, fontSize: 52, lineHeight: 1, opacity: spin ? 0 : 1, transition: 'opacity 0.3s' }}>
        {cancelled ? '−' : '＋'}{Math.abs(amount)}
      </div>

      {shopName && (
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ position: 'relative', display: 'block', flex: 'none', width: 36, height: 36, border: `2px solid ${color.white}`, borderRadius: 10, overflow: 'hidden', boxSizing: 'border-box', background: `#5E4B3C center/cover no-repeat url(${shopPhotoUrl(shopPhoto) || ''})` }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{shopName}</span>
        </div>
      )}
      {note && <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#E3DED6', textAlign: 'center' }}>{note}</div>}

      <div style={{ alignSelf: 'stretch', marginTop: 'auto', padding: '12px 16px', borderRadius: 20, border: '2px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>モグコイン</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: font.dela, fontSize: 18, color: '#E3DED6' }}>{from}</span>
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M1 6h14M11 1.5 15.5 6 11 10.5" fill="none" stroke="#E3DED6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span aria-label={`モグコイン ${to}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: color.white }}>
            <MoguCoin size={26} />
            <span style={{ fontFamily: font.dela, fontSize: 22, lineHeight: 1 }}>{n}</span>
          </span>
        </span>
      </div>

      {onOpenShop && (
        <button type="button" onClick={onOpenShop} className="ui-btn" style={{ alignSelf: 'stretch', marginTop: 14, height: 52, border: 0, borderRadius: 26, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
          お店のページを見る
        </button>
      )}
      <button type="button" onClick={onClose} className="ui-btn" style={{ alignSelf: 'stretch', marginTop: 6, height: 48, border: 0, background: 'transparent', color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
        閉じる
      </button>
    </div>
  );
}
