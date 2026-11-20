import { useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { PHOTO_KINDS } from '../../../lib/registerForm';
import { inspectPhoto, uploadShopPhoto } from '../../../lib/shopPhoto';
import { addShopPhoto, visitError } from '../../../lib/visit';
import { useAuth } from '../../../context/AuthContext';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ㉒-14・15 写真を足す
//   ［撮る］［ライブラリから選ぶ］。写真ごとの種類と「自分で撮った写真です」
// =============================================================

export default function AddPhotoStep({ shop, room, onBack, onDone }) {
  const { user } = useAuth();
  const [picked, setPicked] = useState([]); // { url, width, height, tooSmall, img, file, kind }
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const camera = useRef(null);
  const library = useRef(null);

  const left = Math.min(room?.photos_left ?? 0, room?.photos_day_left ?? 0);

  const take = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, left - picked.length));
    e.target.value = '';
    const shots = await Promise.all(files.map(inspectPhoto));
    setPicked([...picked, ...shots.map((s) => ({ ...s, kind: 'food' }))]);
  };

  const ok = picked.length > 0 && mine && picked.every((p) => !p.tooSmall);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const p of picked) {
        const up = await uploadShopPhoto(user.id, p);
        await addShopPhoto({
          shopId: shop.id,
          kind: up.kind,
          path: up.path,
          cardPath: up.card_path,
          width: up.width,
          height: up.height,
        });
      }
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
        aria-label="写真を足す"
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
          <h2 style={{ margin: 0, flex: 1, textAlign: 'center', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>写真を足す</h2>
          <span style={{ width: 44 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 500, color: color.sub }}>
            あと{Math.max(0, left - picked.length)}枚まで足せます
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <Big label="撮る" icon="camera" onClick={() => camera.current?.click()} />
            <Big label="ライブラリから選ぶ" icon="tray" onClick={() => library.current?.click()} />
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" onChange={take} style={{ display: 'none' }} />
          <input ref={library} type="file" accept="image/*" multiple onChange={take} style={{ display: 'none' }} />

          {picked.map((p, i) => (
            <div key={p.url} style={{ marginTop: 18 }}>
              <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: p.tooSmall ? `3px solid ${color.red}` : `1px solid ${color.line}` }}>
                <img src={p.url} alt="" style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }} />
                <button
                  type="button"
                  aria-label="この写真をやめる"
                  onClick={() => setPicked(picked.filter((_, n) => n !== i))}
                  className="ui-btn"
                  style={{ position: 'absolute', right: 8, top: 8, width: 36, height: 36, padding: 0, border: 0, borderRadius: 18, background: 'rgba(46,44,42,0.72)', color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="close" size={18} color={color.white} strokeWidth={2.5} />
                </button>
              </div>
              {p.tooSmall && (
                <p style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: color.red }}>
                  <Icon name="warning" size={16} color={color.red} />
                  この写真は小さすぎるため使えません
                </p>
              )}
              <ChipRow style={{ marginTop: 10 }}>
                {PHOTO_KINDS.map((k) => (
                  <ChoiceChip
                    key={k.value}
                    selected={p.kind === k.value}
                    onClick={() => setPicked(picked.map((x, n) => (n === i ? { ...x, kind: k.value } : x)))}
                  >
                    {k.label}
                  </ChoiceChip>
                ))}
              </ChipRow>
            </div>
          ))}

          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => setMine(!mine)}
              className="ui-btn"
              style={{ width: '100%', minHeight: 60, marginTop: 20, padding: '0 2px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none', width: 26, height: 26, borderRadius: 7,
                  border: `${stroke.shape}px solid ${color.ink}`,
                  background: mine ? color.ink : color.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {mine && <Icon name="check" size={16} color={color.white} strokeWidth={3} />}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5 }}>自分で撮った写真です</span>
            </button>
          )}

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
          {!busy && <span style={{ fontSize: 15, opacity: 0.85 }}>+{picked.length || 1}</span>}
        </button>
      </section>
    </>
  );
}

function Big({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 1, minHeight: 112, boxSizing: 'border-box', padding: 12,
        border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, background: color.white,
        color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <Icon name={icon} size={28} />
      {label}
    </button>
  );
}
