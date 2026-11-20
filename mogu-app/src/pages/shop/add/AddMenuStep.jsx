import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { addShopMenuItem, visitError } from '../../../lib/visit';
import TextField from '../../../components/ui/TextField';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ㉒-18 おすすめメニューを足す（1品＋2・3品まで）
// =============================================================

export default function AddMenuStep({ shop, onBack, onDone }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ok = name.trim() !== '';

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await addShopMenuItem({
        shopId: shop.id,
        name: name.trim(),
        price: price.trim() === '' ? null : Number(price.replace(/[^\d]/g, '')),
      });
      onDone();
    } catch (e) {
      setError(visitError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="おすすめメニューを足す"
        style={{
          position: 'absolute', left: 0, right: 0, top: 60, bottom: 0, boxSizing: 'border-box',
          padding: '10px 20px 34px', border: `${stroke.shape}px solid ${color.ink}`, borderBottom: 0,
          borderRadius: '32px 32px 0 0', background: color.white, display: 'flex', flexDirection: 'column', zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, margin: '0 -8px' }}>
          <button type="button" aria-label="戻る" onClick={onBack} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={24} />
          </button>
          <h2 style={{ margin: 0, flex: 1, textAlign: 'center', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>おすすめメニュー</h2>
          <span style={{ width: 44 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ marginTop: 6 }}>
            <TextField label="品名" value={name} onChange={setName} placeholder="季節のフルーツサワー" />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextField label="値段（任意）" value={price} onChange={setPrice} placeholder="800" inputMode="numeric" />
          </div>

          {error && (
            <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: color.red }}>
              <Icon name="warning" size={17} color={color.red} />
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!ok || busy}
          className="ui-btn"
          style={{ flex: 'none', width: '100%', height: 60, marginTop: 14, border: 0, borderRadius: 30, background: !ok || busy ? color.lineStrong : color.ink, color: color.white, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {busy ? '送っています…' : '足す'}
          {!busy && <span style={{ fontSize: 15, opacity: 0.85 }}>+2</span>}
        </button>
      </section>
    </>
  );
}
