import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import {
  BUDGET_BUCKETS,
  GENDERS,
  TIME_OF_DAY,
  toDateKey,
  todayKey,
  visitedLabel,
  yesterdayKey,
} from '../../../lib/registerForm';
import ChoiceChip, { ChipField, ChipRow } from '../../../components/ui/ChoiceChip';
import StepFrame from './StepFrame';

// ⑱-4 必須3：行った日と予算感（確定版 Final-18 の4）
//   予算は「価格帯」ではなく「予算感」（みんなが使った金額の投票）
//   性別は、はじめて予算感を入れるときだけ聞く
export default function VisitBudgetStep({ form, onChange, askGender, onOpenCalendar }) {
  const today = todayKey();
  const yesterday = yesterdayKey();
  const custom = form.visitedOn && form.visitedOn !== today && form.visitedOn !== yesterday;

  return (
    <StepFrame form={form} step="visit" title="いつ行った？ いくら使った？">
      <p style={{ flex: 'none', margin: '4px 0 0', fontSize: 13, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
        金額は、飲み物も入れたひとりぶん
      </p>

      <ChipField label="行った日" style={{ marginTop: 14 }}>
        <ChoiceChip selected={form.visitedOn === today} onClick={() => onChange({ visitedOn: today })}>
          今日
        </ChoiceChip>
        <ChoiceChip selected={form.visitedOn === yesterday} onClick={() => onChange({ visitedOn: yesterday })}>
          昨日
        </ChoiceChip>
        <ChoiceChip selected={custom} onClick={onOpenCalendar}>
          {custom ? visitedLabel(form.visitedOn) : '日付を選ぶ'}
        </ChoiceChip>
      </ChipField>

      <ChipField label="時間" style={{ marginTop: 10 }}>
        {TIME_OF_DAY.map((t) => (
          <ChoiceChip key={t.value} selected={form.timeOfDay === t.value} onClick={() => onChange({ timeOfDay: t.value })}>
            {t.label}
          </ChoiceChip>
        ))}
      </ChipField>

      <div style={{ flex: 'none', marginTop: 16, fontSize: 13, fontWeight: 700 }}>ひとりいくら？</div>
      <ChipRow style={{ marginTop: 8 }}>
        {BUDGET_BUCKETS.map((b) => (
          <ChoiceChip key={b.value} selected={form.budgetBucket === b.value} onClick={() => onChange({ budgetBucket: b.value })}>
            {b.label}
          </ChoiceChip>
        ))}
      </ChipRow>

      {askGender && (
        <>
          <ChipField label="あなたは" style={{ marginTop: 16 }}>
            {GENDERS.map((g) => (
              <ChoiceChip key={g.value} selected={form.gender === g.value} onClick={() => onChange({ gender: g.value })}>
                {g.label}
              </ChoiceChip>
            ))}
          </ChipField>
          <p style={{ flex: 'none', margin: '6px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
            予算を男女別に出すためだけに使います（ほかの人には出ません。次からは聞きません）
          </p>
        </>
      )}
    </StepFrame>
  );
}

// ⑱-4b 行った日のカレンダー（先の日は選べない）
export function VisitCalendar({ value, onDone, onCancel }) {
  const today = new Date();
  const start = value ? new Date(`${value}T00:00:00`) : today;
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const [picked, setPicked] = useState(value || toDateKey(today));

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const pad = firstDay.getDay();
  const todayK = toDateKey(today);

  const canGoNext = month.getFullYear() < today.getFullYear()
    || (month.getFullYear() === today.getFullYear() && month.getMonth() < today.getMonth());

  const cells = [];
  for (let i = 0; i < pad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="行った日"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
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
          <button
            type="button"
            onClick={onCancel}
            className="ui-btn"
            style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}
          >
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>行った日</h2>
          <button
            type="button"
            onClick={() => onDone(picked)}
            className="ui-btn"
            style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
          >
            完了
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <MonthArrow dir="prev" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
            <span style={{ fontFamily: font.dela, fontSize: 17 }}>
              {month.getFullYear()}年{month.getMonth() + 1}月
            </span>
            {canGoNext ? (
              <MonthArrow dir="next" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
            ) : (
              <span style={{ width: 44 }} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginTop: 6 }}>
            {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
              <span key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: color.sub }}>
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <span key={`p${i}`} style={{ height: 44 }} />;
              const key = toDateKey(new Date(month.getFullYear(), month.getMonth(), d));
              const future = key > todayK;
              const isPicked = key === picked;
              const isToday = key === todayK;
              return (
                <span key={key} style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => setPicked(key)}
                    className="ui-btn"
                    aria-current={isToday ? 'date' : undefined}
                    style={{
                      width: 40,
                      height: 40,
                      padding: 0,
                      border: 0,
                      borderRadius: '50%',
                      fontFamily: 'inherit',
                      fontSize: 15,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isPicked ? color.ink : 'transparent',
                      color: isPicked ? color.white : future ? color.lineStrong : color.ink,
                      boxShadow: !isPicked && isToday ? `inset 0 0 0 2px ${color.ink}` : undefined,
                    }}
                  >
                    {d}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function MonthArrow({ dir, onClick }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? '前の月' : '次の月'}
      onClick={onClick}
      className="ui-btn"
      style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
        <path d={dir === 'prev' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
      </svg>
    </button>
  );
}
