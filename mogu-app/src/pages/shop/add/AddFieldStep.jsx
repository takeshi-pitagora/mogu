import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { ADDRESS_KEY, LAST_ORDER_KEY, PHONE_KEY, WEEKDAYS, groupOf, isPicked, setHours, toggleField } from '../../../lib/shopFields';
import { INFO_ROWS } from '../../../lib/shopProfile';
import { addShopField, visitError } from '../../../lib/visit';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import TextField from '../../../components/ui/TextField';
import Icon from '../../../components/ui/Icon';
import HoursSheet from '../register/HoursSheet';
import LastOrderSheet from '../register/LastOrderSheet';

// =============================================================
// ㉒-16・17 空いている項目を書く
//   空いているものだけの一覧 → ⑱と同じ入れ方。書いた人の名前が残る。
//   すでに書かれた情報は書き換えられない。
// =============================================================

function titleOf(key) {
  if (key.startsWith('hours_')) return `営業時間（${WEEKDAYS[Number(key.slice(6))]}）`;
  if (key === LAST_ORDER_KEY) return 'ラストオーダー';
  return INFO_ROWS.find((r) => r.key === key)?.title || key;
}

export default function AddFieldStep({ shop, room, onBack, onDone }) {
  const [key, setKey] = useState(null);
  const [fields, setFields] = useState({}); // ⑱と同じ形で持つ
  const [sheet, setSheet] = useState(null); // 'hours' | 'lastOrder'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const open = room?.open_fields || [];
  const group = key ? groupOf(key) : null;
  const value = (key && fields[key]) || '';

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await addShopField({ shopId: shop.id, fieldKey: key, value });
      onDone();
    } catch (e) {
      setError(visitError(e));
    } finally {
      setBusy(false);
    }
  };

  const frame = (title, body, footer) => (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
          <button type="button" aria-label="戻る" onClick={key ? () => { setKey(null); setError(null); } : onBack} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={24} />
          </button>
          <h2 style={{ margin: 0, flex: 1, textAlign: 'center', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>{title}</h2>
          <span style={{ width: 44 }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{body}</div>
        {footer}
      </section>
    </>
  );

  // 一覧（空いているものだけ）
  if (!key) {
    return frame(
      '空いている項目',
      <>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: color.sub }}>
          書いた人の名前が残ります。すでにある情報は書き換えられません
        </p>
        {open.map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKey(k); setFields({}); }}
            className="ui-btn"
            style={{ width: '100%', minHeight: 60, padding: '0 2px', border: 0, borderTop: i === 0 ? `1px solid ${color.line}` : 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>{titleOf(k)}</span>
            <Icon name="chevronRight" size={18} color={color.sub} />
          </button>
        ))}
        {open.length === 0 && (
          <p style={{ margin: '20px 0 0', fontSize: 15, fontWeight: 500, color: color.sub }}>空いている項目はありません</p>
        )}
      </>,
      null,
    );
  }

  // 1項目を書く（⑱と同じ入れ方）
  const body = (
    <>
      {key.startsWith('hours_') ? (
        <button
          type="button"
          onClick={() => setSheet('hours')}
          className="ui-btn"
          style={{ width: '100%', minHeight: 60, marginTop: 6, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.focus}px solid ${color.ink}`, borderRadius: 20, background: color.white, color: value ? color.ink : color.sub, fontFamily: 'inherit', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left' }}
        >
          {value || '時間を選ぶ'}
          <Icon name="chevronRight" size={18} color={color.sub} />
        </button>
      ) : key === LAST_ORDER_KEY ? (
        <button
          type="button"
          onClick={() => setSheet('lastOrder')}
          className="ui-btn"
          style={{ width: '100%', minHeight: 60, marginTop: 6, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.focus}px solid ${color.ink}`, borderRadius: 20, background: color.white, color: value ? color.ink : color.sub, fontFamily: 'inherit', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left' }}
        >
          {value || '時こくを選ぶ'}
          <Icon name="chevronRight" size={18} color={color.sub} />
        </button>
      ) : group ? (
        <ChipRow style={{ marginTop: 10 }}>
          {group.options.map((o) => (
            <ChoiceChip key={o} selected={isPicked(fields, key, o)} onClick={() => setFields(toggleField(fields, key, o))}>
              {o}
            </ChoiceChip>
          ))}
        </ChipRow>
      ) : (
        <div style={{ marginTop: 10 }}>
          <TextField
            label={titleOf(key)}
            value={value}
            onChange={(v) => setFields({ ...fields, [key]: v })}
            placeholder={key === PHONE_KEY ? '03-0000-0000' : key === ADDRESS_KEY ? '東京都渋谷区…' : ''}
            inputMode={key === PHONE_KEY ? 'tel' : undefined}
          />
        </div>
      )}

      {error && (
        <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: color.red }}>
          <Icon name="warning" size={17} color={color.red} />
          {error}
        </p>
      )}

      {sheet === 'hours' && (
        <HoursSheet
          day={Number(key.slice(6))}
          value={value || null}
          onDone={(v) => { setFields(setHours(fields, Number(key.slice(6)), v)); setSheet(null); }}
          onCancel={() => setSheet(null)}
        />
      )}
      {sheet === 'lastOrder' && (
        <LastOrderSheet value={value || null} onDone={(v) => { setFields({ ...fields, [key]: v }); setSheet(null); }} onCancel={() => setSheet(null)} />
      )}
    </>
  );

  return frame(
    titleOf(key),
    body,
    <button
      type="button"
      onClick={send}
      disabled={!value.trim() || busy}
      className="ui-btn"
      style={{ flex: 'none', width: '100%', height: 60, marginTop: 14, border: 0, borderRadius: 30, background: !value.trim() || busy ? color.lineStrong : color.ink, color: color.white, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      {busy ? '送っています…' : '足す'}
      {!busy && <span style={{ fontSize: 15, opacity: 0.85 }}>+1</span>}
    </button>,
  );
}
