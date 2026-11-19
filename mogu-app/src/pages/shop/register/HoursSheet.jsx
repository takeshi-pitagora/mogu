import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { CLOSED, TIME_CHOICES, WEEKDAYS } from '../../../lib/shopFields';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';

// 曜日の営業時間を決めるシート
export default function HoursSheet({ day, value, onDone, onCancel }) {
  const closed = value === CLOSED;
  const [isClosed, setIsClosed] = useState(closed);
  const [from, setFrom] = useState(!closed && value ? value.split('〜')[0] : '17:00');
  const [to, setTo] = useState(!closed && value ? value.split('〜')[1] : '23:00');

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${WEEKDAYS[day]}曜日の営業時間`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 360,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onCancel} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{WEEKDAYS[day]}曜日</h2>
          <button
            type="button"
            onClick={() => onDone(isClosed ? CLOSED : `${from}〜${to}`)}
            className="ui-btn"
            style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
          >
            完了
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <ChipRow style={{ marginTop: 4 }}>
            <ChoiceChip selected={isClosed} onClick={() => setIsClosed(true)}>
              定休日
            </ChoiceChip>
            <ChoiceChip selected={!isClosed} onClick={() => setIsClosed(false)}>
              営業する
            </ChoiceChip>
          </ChipRow>

          {!isClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <TimeSelect label="開く時間" value={from} onChange={setFrom} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>〜</span>
              <TimeSelect label="閉じる時間" value={to} onChange={setTo} />
            </div>
          )}

          <button
            type="button"
            onClick={() => onDone(null)}
            className="ui-btn"
            style={{ marginTop: 18, height: 44, padding: '0 14px', border: 0, background: 'transparent', color: color.sub, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
          >
            この曜日を空にする
          </button>
        </div>
      </section>
    </>
  );
}

function TimeSelect({ label, value, onChange }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1,
        minWidth: 0,
        height: 56,
        boxSizing: 'border-box',
        padding: '0 14px',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 18,
        background: color.white,
        color: color.ink,
        font: 'inherit',
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {TIME_CHOICES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
