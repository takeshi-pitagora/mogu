import { useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { APPEAL_MAX, POST_RULES, RULE_STAGES, STAGES, nextDayLabel, submitAppeal, untilLabel } from '../../lib/penalty';
import BottomSheet, { SheetTitle } from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Icon from '../../components/ui/Icon';
import { GUIDE } from '../../lib/chara';

// =============================================================
// ㉗ 警告・停止のシートと、全画面のお知らせ、問い合わせ、投稿のルール
//   どの段も同じ順番：段・見出し・理由・どの投稿か・起きたこと・これから
// =============================================================

function StageLabel({ stage }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 12, background: color.ink, color: color.white, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {STAGES[stage]?.label || 'お知らせ'}
    </span>
  );
}

function dateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ---- ㉗-3・9・10 通知の行を押したとき：シートで短く ----
export function PenaltySheet({ open, penalty, onDetail, onClose }) {
  if (!penalty) return null;
  return (
    <BottomSheet open={open} onClose={onClose} charaCode={GUIDE.harry} ariaLabel="運営からのお知らせ" minHeight={360}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StageLabel stage={penalty.stage} />
        <span style={{ fontSize: 12, color: color.sub }}>{dateLabel(penalty.created_at)}</span>
      </div>
      <SheetTitle style={{ marginTop: 10, textAlign: 'left' }}>{headline(penalty)}</SheetTitle>
      {penalty.target && (
        <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: color.sub, textAlign: 'left' }}>{penalty.target}</p>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, textAlign: 'left' }}>{happened(penalty)}</p>
      <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7, textAlign: 'left', color: color.sub }}>{next(penalty)}</p>
      <div style={{ flex: 1, minHeight: 0 }} />
      <Button variant="primary" onClick={onDetail} style={{ marginTop: 18 }}>
        くわしく
      </Button>
      <Button variant="text" onClick={onClose} style={{ marginTop: 6 }}>
        閉じる
      </Button>
    </BottomSheet>
  );
}

function headline(p) {
  if (p.headline) return p.headline;
  switch (p.stage) {
    case 'suspended':
      return `${untilLabel(p.ends_at)}まで、投稿ができません`;
    case 'banned':
      return 'このアカウントは利用を停止しています。';
    default:
      return p.reason;
  }
}
function happened(p) {
  return p.happened || 'この投稿は消し、そのぶんの仮のコインは取り消しました。';
}
function next(p) {
  if (p.next_text) return p.next_text;
  switch (p.stage) {
    case 'notice':
      return '同じことが続くと、警告になります。';
    case 'warning':
      return '90日以内にもう1回警告を受けると、30日間投稿できなくなります。';
    case 'suspended':
      return `${nextDayLabel(p.ends_at)}から、また投稿できます。このあとにまた警告を受けると、アカウントが使えなくなることがあります。`;
    case 'banned':
      return 'コインはすべて消えています。';
    default:
      return '';
  }
}

// ---- ㉗-4・5・11・12 全画面のお知らせ ----
export function PenaltyFullScreen({ penalty, onAppeal, onRules, onClose }) {
  if (!penalty) return null;
  const suspended = penalty.stage === 'suspended';
  return (
    <div style={{ position: 'absolute', inset: 0, background: color.white, zIndex: 32, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: 'env(safe-area-inset-top) 8px 0', borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
        <span style={{ width: 44 }} />
        <span style={{ fontFamily: font.dela, fontSize: 16 }}>mogu 運営</span>
        <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={24} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StageLabel stage={penalty.stage} />
          <span style={{ fontSize: 12, color: color.sub }}>{dateLabel(penalty.created_at)}</span>
        </div>
        <h1 style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.4 }}>{headline(penalty)}</h1>

        <Section title="理由">{penalty.reason}</Section>
        {penalty.target && <Section title="どの投稿か">{penalty.target}</Section>}
        <Section title="起きたこと">{happened(penalty)}</Section>
        <Section title="これから">{next(penalty)}</Section>

        {suspended && (
          <>
            <Section title="できないこと">
              お店の登録、写真を足すこと、タグを付けること、ひとことを書くこと、来店スタンプ。ランキングからも外れます。
            </Section>
            <Section title="できること">見る・スワイプ・保存はこれまでどおりできます。</Section>
          </>
        )}

        <div style={{ marginTop: 28 }}>
          <Button variant="secondary" onClick={onAppeal}>
            この判断について問い合わせる
          </Button>
          <Button variant="text" onClick={onRules} style={{ marginTop: 8 }}>
            投稿のルールを見る
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>{title}</div>
      <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}

// ---- ㉗-6・7 この判断について問い合わせる ----
export function AppealSheet({ penalty, onClose }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await submitAppeal({ penaltyId: penalty?.id, body: body.trim(), photoPaths: [] });
      setDone(true);
    } catch {
      setError('送れませんでした。少し待ってもう一度お願いします。');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 33 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="この判断について問い合わせる"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 60,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 34,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <span style={{ width: 44 }} />
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>問い合わせる</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={24} />
          </button>
        </div>

        {done ? (
          <>
            <div style={{ flex: 1, minHeight: 0, paddingTop: 10 }}>
              <p style={{ margin: 0, fontFamily: font.dela, fontSize: 18, lineHeight: 1.4 }}>受け付けました</p>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7 }}>お返事はお知らせに届きます。</p>
            </div>
            <Button variant="primary" onClick={onClose}>
              閉じる
            </Button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px 12px' }}>
              {penalty && (
                <div style={{ padding: '12px 14px', borderRadius: 16, background: color.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StageLabel stage={penalty.stage} />
                    <span style={{ fontSize: 12, color: color.sub }}>{dateLabel(penalty.created_at)}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{headline(penalty)}</div>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <TextField label="伝えたいこと" value={body} onChange={setBody} multiline rows={7} maxLength={APPEAL_MAX} showCount />
              </div>
            </div>
            <div style={{ flex: 'none', paddingTop: 12 }}>
              {error && <p role="alert" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>}
              <Button variant="primary" onClick={send} disabled={body.trim() === '' || sending}>
                {sending ? '送っています' : '送信する'}
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// ---- ㉗-13・15・16 投稿が止められているときに出すシート ----
export function SuspendedSheet({ open, penalty, onDetail, onClose }) {
  if (!penalty) return null;
  const banned = penalty.stage === 'banned';
  return (
    <BottomSheet open={open} onClose={onClose} charaCode={GUIDE.harry} ariaLabel="いまは投稿ができません" minHeight={320}>
      <SheetTitle>
        {banned ? 'このアカウントは利用を停止しています' : `${untilLabel(penalty.ends_at)}まで、投稿ができません`}
      </SheetTitle>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, textAlign: 'left' }}>
        {banned
          ? 'くわしくは、お知らせを見てください。'
          : `${nextDayLabel(penalty.ends_at)}から、また投稿できます。見る・スワイプ・保存はこれまでどおりできます。`}
      </p>
      <div style={{ flex: 1, minHeight: 0 }} />
      <Button variant="primary" onClick={onDetail} style={{ marginTop: 18 }}>
        くわしく
      </Button>
      <Button variant="text" onClick={onClose} style={{ marginTop: 6 }}>
        閉じる
      </Button>
    </BottomSheet>
  );
}

// ---- ㉗-17・18 投稿のルール ----
export function PostRulesScreen({ onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: color.white, zIndex: 32, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: 'env(safe-area-inset-top) 8px 0', borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
        <button type="button" aria-label="戻る" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={22} />
        </button>
        <span style={{ fontFamily: font.dela, fontSize: 16 }}>投稿のルール</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 20px 40px' }}>
        {POST_RULES.map((r, i) => (
          <div key={r.title} style={{ paddingTop: i === 0 ? 0 : 18 }}>
            <div style={{ fontFamily: font.dela, fontSize: 16 }}>{r.title}</div>
            <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.75 }}>{r.body}</p>
          </div>
        ))}

        <h2 style={{ margin: '32px 0 0', fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>守られていないとき</h2>
        <div style={{ marginTop: 8 }}>
          {RULE_STAGES.map((s) => (
            <div key={s.stage} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderTop: `1px solid ${color.line}` }}>
              <span style={{ flex: 'none', paddingTop: 2 }}>
                <StageLabel stage={s.stage} />
              </span>
              <p style={{ flex: 1, margin: 0, fontSize: 14, lineHeight: 1.7 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
