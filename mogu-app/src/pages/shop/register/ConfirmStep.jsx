import { color, font, stroke } from '../../../theme/tokens';
import {
  FULL_FIELDS,
  FULL_PHOTOS,
  HIGHLIGHTS,
  budgetBucketLabel,
  fullRegisterCount,
  requiredDoneCount,
  stepDone,
} from '../../../lib/registerForm';
import { walkLabel } from '../../../lib/shops';

// ⑱-14・15 登録の前に（確定版 Final-18）
//   入れたものを1行ずつ見せ、「関係者ではありません」のチェックで［登録する］
export default function ConfirmStep({ form, onChange }) {
  const full = fullRegisterCount(form);
  const done = requiredDoneCount(form);
  const photos = form.photos.filter((p) => !p.tooSmall).length;
  const leftPhotos = Math.max(0, FULL_PHOTOS - full.photos);
  const leftFields = Math.max(0, FULL_FIELDS - full.fields);

  const rows = [
    ['最寄駅', stepDone(form, 'station') ? walkLabel(form.station?.name && `${form.station.name}駅`, form.walkMin) : null],
    ['ジャンル', [form.genreMain, form.genreSub].filter(Boolean).join('・') || null],
    ['行った日・予算感', stepDone(form, 'visit') ? visitLine(form) : null],
    ['写真', photos > 0 ? `${photos}枚` : null],
    ['イチ押し', form.highlightKeys.map((k) => HIGHLIGHTS.find((h) => h.key === k)?.label).filter(Boolean).join('・') || null],
  ];

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
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < done ? color.accent : color.line }} />
        ))}
      </div>

      <h2 style={{ flex: 'none', margin: '18px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.35 }}>登録の前に</h2>

      <div style={{ flex: 'none', marginTop: 10 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 44, borderBottom: `1px solid ${color.line}` }}>
            <span style={{ flex: 'none', fontSize: 13, color: color.sub }}>{label}</span>
            {value ? (
              <span style={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: color.ink, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <CheckMark />
                {value}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>
                {label === '写真' ? 'まだです（0枚）' : 'まだです'}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 'none', marginTop: 14, padding: '14px 16px', borderRadius: 20, background: color.surface }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: font.dela, fontSize: 15 }}>しっかり登録</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>写真3枚と任意の項目5つで ＋5コイン</span>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          <Bar label="写真" now={full.photos} max={FULL_PHOTOS} />
          <Bar label="任意の項目" now={full.fields} max={FULL_FIELDS} />
        </div>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {leftPhotos === 0 && leftFields === 0
            ? 'しっかり登録になりました　＋5コイン'
            : leftPhotos > 0
              ? `写真あと${leftPhotos}枚で ＋5コイン`
              : `任意あと${leftFields}つで ＋5コイン`}
        </div>
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={form.notRelated}
        onClick={() => onChange({ notRelated: !form.notRelated })}
        className="ui-btn"
        style={{
          flex: 'none',
          width: '100%',
          minHeight: 52,
          marginTop: 14,
          boxSizing: 'border-box',
          padding: '10px 14px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderRadius: 18,
          background: color.white,
          color: color.ink,
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 26,
            height: 26,
            boxSizing: 'border-box',
            border: `${stroke.shape}px solid ${color.ink}`,
            borderRadius: 8,
            background: form.notRelated ? color.ink : color.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {form.notRelated && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.white} strokeWidth="3" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
        このお店で働いている人・関係者ではありません
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: color.sub, whiteSpace: 'nowrap' }}>必須</span>
      </button>

      <p style={{ flex: 'none', margin: '10px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
        登録すると、写真と情報はみんなに公開されます。登録してから24時間は自分で直せます。
      </p>
    </div>
  );
}

function visitLine(form) {
  const [, m, d] = String(form.visitedOn).split('-');
  const when = form.timeOfDay === 'lunch' ? '昼' : '夜';
  return `${Number(m)}/${Number(d)} ${when} ${budgetBucketLabel(form.budgetBucket) || ''}`.trim();
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Bar({ label, now, max }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
        <span>{label}</span>
        <span>
          {now}/{max}
        </span>
      </div>
      <div style={{ marginTop: 5 }}>
        <span aria-hidden="true" style={{ display: 'block', width: '100%', height: 6, borderRadius: 3, background: color.line, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${Math.round((now / max) * 100)}%`, height: '100%', background: color.accent }} />
        </span>
      </div>
    </div>
  );
}
