import { color } from '../../../theme/tokens';
import { HIGHLIGHTS, HIGHLIGHT_MAX, HIGHLIGHT_REASON_MAX } from '../../../lib/registerForm';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import TextField from '../../../components/ui/TextField';
import StepFrame from './StepFrame';

// ⑱-8 必須5：イチ押しポイント（確定版 Final-18 の8）
//   8つから1〜2つ。理由のひとことは任意
export default function HighlightStep({ form, onChange }) {
  const keys = form.highlightKeys;
  const full = keys.length >= HIGHLIGHT_MAX;

  const toggle = (k) => {
    if (keys.includes(k)) onChange({ highlightKeys: keys.filter((x) => x !== k) });
    else if (!full) onChange({ highlightKeys: [...keys, k] });
  };

  return (
    <StepFrame form={form} step="highlight" title="いちばんのおすすめは？">
      <div style={{ flex: 'none', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ flex: 'none', margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>8つから1〜2つ</p>
          <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>
            {keys.length}/{HIGHLIGHT_MAX}
          </span>
        </div>

        <ChipRow style={{ marginTop: 10 }}>
          {HIGHLIGHTS.map((h) => (
            <ChoiceChip key={h.key} selected={keys.includes(h.key)} disabled={full} onClick={() => toggle(h.key)}>
              {h.label}
            </ChoiceChip>
          ))}
        </ChipRow>

        <div style={{ marginTop: 16 }}>
          <TextField
            label="理由のひとこと（任意）"
            value={form.highlightReason}
            onChange={(v) => onChange({ highlightReason: v })}
            maxLength={HIGHLIGHT_REASON_MAX}
            showCount
          />
        </div>
      </div>
    </StepFrame>
  );
}
