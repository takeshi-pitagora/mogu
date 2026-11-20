import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { TIME_CHOICES } from '../../../lib/shopFields';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';

// ラストオーダーの時こくを選ぶシート（確定版 ㉓-5 のラストオーダーの行から開く）
export default function LastOrderSheet({ value, onDone, onCancel }) {
  const [time, setTime] = useState(value || '22:00');

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="ラストオーダー"
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
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>ラストオーダー</h2>
          <button
            type="button"
            onClick={() => onDone(time)}
            className="ui-btn"
            style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
          >
            完了
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <ChipRow style={{ marginTop: 4 }}>
            {TIME_CHOICES.map((t) => (
              <ChoiceChip key={t} selected={time === t} onClick={() => setTime(t)}>
                {t}
              </ChoiceChip>
            ))}
          </ChipRow>
        </div>
      </section>
    </>
  );
}
