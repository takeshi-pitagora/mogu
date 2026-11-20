import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { confirmShopField, visitError } from '../../../lib/visit';
import { INFO_ROWS } from '../../../lib/shopProfile';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ㉒-12 2回目から：アンケートのあとに情報の確認を1問（30日に1回・＋1）
//   「違う」は㉓の修正依頼へ（その項目が選ばれた状態で始まる）
// =============================================================

export default function ConfirmFieldStep({ shop, field, onDone, onAskEdit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const title = INFO_ROWS.find((r) => r.key === field.field_key)?.title
    || (field.field_key.startsWith('hours_') ? '営業時間・定休日' : 'お店の情報');

  const answer = async (a) => {
    setBusy(true);
    setError(null);
    try {
      await confirmShopField({ shopId: shop.id, fieldKey: field.field_key, answer: a });
      if (a === 'different') onAskEdit?.(field.field_key);
      else onDone?.();
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
        aria-label="この情報は合っていますか？"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>

        <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35 }}>
          この情報は{'\n'}いまも合っていますか？
        </h2>

        <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 20, background: color.surface }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{field.value}</div>
        </div>

        {error && (
          <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: color.red }}>
            <Icon name="warning" size={17} color={color.red} />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => answer('same')}
          disabled={busy}
          className="ui-btn"
          style={{ width: '100%', height: 60, marginTop: 20, border: 0, borderRadius: 30, background: busy ? color.lineStrong : color.ink, color: color.white, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          合っています
          <span style={{ fontSize: 15, opacity: 0.85 }}>+1</span>
        </button>
        <button
          type="button"
          onClick={() => answer('different')}
          disabled={busy}
          className="ui-btn"
          style={{ width: '100%', height: 56, marginTop: 10, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
        >
          違う（修正を依頼する）
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="ui-btn"
          style={{ width: '100%', height: 48, marginTop: 6, border: 0, background: 'transparent', color: color.sub, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}
        >
          わからない
        </button>
      </section>
    </>
  );
}
