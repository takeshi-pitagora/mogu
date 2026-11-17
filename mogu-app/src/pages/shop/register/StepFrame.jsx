import { color, font } from '../../../theme/tokens';
import { REQUIRED_STEPS, requiredDoneCount, stepDone } from '../../../lib/registerForm';

// ⑱ 必須の5つに共通の形（確定版 Final-18）
//   上に店名と「必須 N/5」、その下に5本の線（できたものはアクセント色）
//   見出しは Dela 24
export default function StepFrame({ form, title, note, children }) {
  const done = requiredDoneCount(form);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {form.name}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          必須 <span style={{ fontFamily: font.dela, fontSize: 15 }}>{done}</span>/5
        </span>
      </div>

      <div aria-hidden="true" style={{ flex: 'none', display: 'flex', gap: 4, marginTop: 8 }}>
        {REQUIRED_STEPS.map((s) => (
          <span key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: stepDone(form, s) ? color.accent : color.line }} />
        ))}
      </div>

      <h2 style={{ flex: 'none', margin: '22px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.35 }}>{title}</h2>
      {note && <p style={{ flex: 'none', margin: '8px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>{note}</p>}

      {children}
    </div>
  );
}

// ボタンの上の、ひとこと（「駅を選び、歩く時間を入れてください」）
export function StepHint({ children }) {
  return (
    <p style={{ flex: 'none', margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 500, lineHeight: 1.6, color: color.ink }}>
      {children}
    </p>
  );
}
