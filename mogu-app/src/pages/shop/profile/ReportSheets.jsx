import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import {
  CLOSURE_TYPES,
  EDITABLE_FIELDS,
  HOW_KNOWN,
  REPORT_DETAIL_MAX,
  REPORT_REASONS,
  REPORT_TITLE,
  reportErrorMessage,
  submitClosureReport,
  submitEditRequest,
  submitShopReport,
} from '../../../lib/shopReport';
import { FIELD_GROUPS, WEEKDAYS, groupOf, hoursLabel, isPicked, setHours, toggleField } from '../../../lib/shopFields';
import HoursSheet from '../register/HoursSheet';
import { fieldMap, hoursText } from '../../../lib/shopProfile';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ㉓ シート型（確定版 Final-23）
//   項目の一覧 → 入力（背の高いシート・中でスクロール）→ 完了と、
//   シートの中身だけが入れかわる。うしろのお店のページはそのまま
// =============================================================

function Sheet({ title, sub, onBack, onClose, hideClose, children, footer, top = 60 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 15 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 56, margin: '0 -8px' }}>
          <span style={{ flex: 'none', width: 44 }}>
            {onBack && (
              <button type="button" aria-label="戻る" onClick={onBack} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="back" size={22} />
              </button>
            )}
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: font.dela, fontSize: 18 }}>{title}</span>
            {sub && <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: color.sub }}>{sub}</span>}
          </span>
          <span style={{ flex: 'none', width: 44 }}>
            {!hideClose && (
              <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={24} />
              </button>
            )}
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px 12px' }}>
          {children}
        </div>

        {footer && <div style={{ flex: 'none', paddingTop: 12 }}>{footer}</div>}
      </section>
    </>
  );
}

// 「直ったら＋3」
function PlusThree() {
  return (
    <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: color.sub }}>
      運営が直したら、3コインが入ります
    </p>
  );
}

// 送れたときの完了の中身
function Done({ title, body, extra }) {
  return (
    <div style={{ paddingTop: 10 }}>
      <p style={{ margin: 0, fontFamily: font.dela, fontSize: 18, lineHeight: 1.4 }}>{title}</p>
      <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7 }}>{body}</p>
      {extra}
    </div>
  );
}

// =============================================================
// ㉓-4〜9 情報の修正を依頼する
// =============================================================
export function EditRequestSheet({ shop, data, checking, startField = null, onClose, onDone }) {
  const map = fieldMap(data.fields);
  const [fieldKey, setFieldKey] = useState(startField);
  const [proposed, setProposed] = useState('');
  const [fields, setFields] = useState({}); // 選ぶ項目のとき
  const [howKnown, setHowKnown] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [hoursDay, setHoursDay] = useState(null);

  const row = EDITABLE_FIELDS.find((f) => f.key === fieldKey);
  const group = fieldKey && fieldKey !== '__hours' ? groupOf(fieldKey) : null;
  const current = shopValue(data.shop, fieldKey) ?? (fieldKey === '__hours' ? hoursSummary(map) : showValue(map.get(fieldKey)?.value)) ?? null;
  const value = fieldKey === '__hours' ? hoursProposed(map, fields) : group ? (fields[fieldKey] || '') : proposed;
  const changed = value.trim() !== '' && value.trim() !== (current || '');
  // 「最後に確認：2026年11月・3人」
  const confirmedLine = (() => {
    const f = map.get(fieldKey === '__hours' ? 'hours_0' : fieldKey);
    if (!f?.last_confirmed_at) return null;
    const d = new Date(f.last_confirmed_at);
    const who = f.confirm_count > 0 ? `・${f.confirm_count}人` : '';
    return `最後に確認：${d.getFullYear()}年${d.getMonth() + 1}月${who}`;
  })();

  if (done) {
    return (
      <Sheet title="情報の修正を依頼する" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>閉じる</Button>}>
        <Done
          title="依頼を受け付けました"
          body="運営が確かめて、結果をお知らせします（7日ほど）。"
          extra={<PlusThree />}
        />
      </Sheet>
    );
  }

  // 項目の一覧（㉓-4）
  if (!fieldKey) {
    return (
      <Sheet title="情報の修正を依頼する" sub={shop.name} onClose={onClose} hideClose>
        <p style={{ margin: '4px 0 6px', fontSize: 16, fontWeight: 700 }}>どの項目を直しますか？</p>
        {EDITABLE_FIELDS.map((f) => {
          const now = shopValue(data.shop, f.key) ?? (f.key === '__hours' ? hoursSummary(map) : showValue(map.get(f.key)?.value));
          const busy = checking.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              disabled={busy}
              onClick={() => setFieldKey(f.key)}
              className="ui-btn"
              style={{
                width: '100%',
                minHeight: 60,
                padding: '10px 2px',
                border: 0,
                borderTop: `1px solid ${color.line}`,
                background: 'transparent',
                color: busy ? color.sub : color.ink,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{f.title}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {busy ? '今確かめているところです' : now || 'まだ情報がありません'}
                </span>
              </span>
              {!busy && <Icon name="chevronRight" size={18} color={color.sub} />}
            </button>
          );
        })}
      </Sheet>
    );
  }

  // 入力（㉓-5〜8）
  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await submitEditRequest({
        shopId: shop.id,
        fieldKey: fieldKey === '__hours' ? 'hours_0' : fieldKey,
        proposed: value.trim(),
        howKnown,
        evidence: evidence.trim() || null,
      });
      setDone(true);
      onDone?.();
    } catch (e) {
      setError(reportErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      title={row?.title || '情報の修正'}
      onBack={() => setFieldKey(null)}
      onClose={onClose}
      hideClose
      footer={
        <>
          {error && <p role="alert" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>}
          <Button variant="primary" onClick={send} disabled={!changed || sending}>
            {sending ? '送っています' : '送信する'}
          </Button>
          <PlusThree />
        </>
      }
    >
      <div style={{ marginTop: 4, padding: '14px 18px', borderRadius: 20, background: color.surface }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>今の内容</div>
        <div style={{ marginTop: 4, fontSize: 17, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {current || 'まだ情報がありません'}
        </div>
        {confirmedLine && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: color.sub }}>{confirmedLine}</div>}
      </div>

      <h3 style={{ margin: '18px 0 0', display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>
        正しい内容
        <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: color.sub }}>変えた所に印</span>
      </h3>
      {fieldKey === '__hours' ? (
        <div style={{ marginTop: 4 }}>
          {WEEKDAYS.map((w, i) => {
            const now = map.get(`hours_${i}`)?.value || null;
            const next = hoursLabel(fields, i);
            const shown = next || now;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setHoursDay(i)}
                className="ui-btn"
                style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}
              >
                <span style={{ flex: 'none', width: 20, fontFamily: font.dela, fontSize: 15 }}>{w}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: next && next !== now ? 700 : 500 }}>
                  {shown || 'まだ情報がありません'}
                </span>
                {next && next !== now && (
                  <span aria-label="変えた所" style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: color.accent }} />
                )}
                <Icon name="chevronRight" size={18} color={color.sub} />
              </button>
            );
          })}
        </div>
      ) : group ? (
        <ChipRow style={{ marginTop: 8 }}>
          {group.options.map((o) => (
            <ChoiceChip key={o} selected={isPicked(fields, fieldKey, o)} onClick={() => setFields(toggleField(fields, fieldKey, o))}>
              {o}
            </ChoiceChip>
          ))}
        </ChipRow>
      ) : (
        <div style={{ marginTop: 8 }}>
          <TextField
            label=""
            value={proposed}
            onChange={setProposed}
            multiline={fieldKey === '__hours' || fieldKey === 'free_text'}
            rows={fieldKey === '__hours' ? 5 : 3}
            placeholder={fieldKey === '__hours' ? '例：火〜日 11:30〜23:00\n定休日：月' : ''}
            maxLength={200}
            showCount
          />
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>どうやって知った？</div>
      <ChipRow style={{ marginTop: 8 }}>
        {HOW_KNOWN.map((h) => (
          <ChoiceChip key={h} selected={howKnown === h} onClick={() => setHowKnown(howKnown === h ? null : h)}>
            {h}
          </ChoiceChip>
        ))}
      </ChipRow>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>写真かリンク</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>なくてもよい</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <TextField label="リンク" value={evidence} onChange={setEvidence} placeholder="https://…" inputMode="url" />
      </div>

      {hoursDay !== null && (
        <HoursSheet
          day={hoursDay}
          value={hoursLabel(fields, hoursDay) || map.get(`hours_${hoursDay}`)?.value || null}
          onDone={(v) => {
            setFields(setHours(fields, hoursDay, v));
            setHoursDay(null);
          }}
          onCancel={() => setHoursDay(null)}
        />
      )}
    </Sheet>
  );
}

// 直したあとの営業時間（直していない曜日は今のまま）。今の内容と同じ形でまとめる
function hoursProposed(map, fields) {
  const merged = new Map(map);
  WEEKDAYS.forEach((d, i) => {
    const v = hoursLabel(fields, i);
    if (v) merged.set(`hours_${i}`, { ...(map.get(`hours_${i}`) || {}), key: `hours_${i}`, value: v });
  });
  return hoursText(merged) || '';
}

// お店そのものの3つ（名前・ジャンル・最寄り駅）の今の内容
function shopValue(shop, key) {
  if (!shop) return undefined;
  if (key === 'name') return shop.name || null;
  if (key === 'genre') return [shop.genre_main, shop.genre_sub].filter(Boolean).join('・') || null;
  if (key === 'station') return shop.station_name ? `${shop.station_name}駅 徒歩${shop.walk_min || '?'}分` : null;
  return undefined;
}

// 選んだ項目は「・」でつなぐ（カード,電子マネー → カード・電子マネー）
function showValue(v) {
  return v ? String(v).split(',').join('・') : v;
}

// 営業時間を1つの文にまとめる（修正依頼の「今の内容」に出す）
function hoursSummary(map) {
  return hoursText(map);
}

// =============================================================
// ㉓-12・13 閉店・移転を報告する
// =============================================================
export function ClosureSheet({ shop, onClose, onDone }) {
  const [type, setType] = useState(null);
  const [movedTo, setMovedTo] = useState('');
  const [howKnown, setHowKnown] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Sheet title="閉店・移転を報告する" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>閉じる</Button>}>
        <Done title="報告を受け付けました" body="運営が確かめて、結果をお知らせします（7日ほど）。" />
      </Sheet>
    );
  }

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await submitClosureReport({ shopId: shop.id, type, movedTo: movedTo.trim(), howKnown, evidence: evidence.trim() });
      setDone(true);
      onDone?.();
    } catch (e) {
      setError(reportErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      title="閉店・移転を報告する"
      onClose={onClose}
      footer={
        <>
          {error && <p role="alert" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>}
          <Button variant="primary" onClick={send} disabled={!type || sending}>
            {sending ? '送っています' : '送信する'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: color.sub }}>お店はどうなっていましたか？</p>
      <ChipRow>
        {CLOSURE_TYPES.map((c) => (
          <ChoiceChip key={c.value} selected={type === c.value} onClick={() => setType(c.value)}>
            {c.label}
          </ChoiceChip>
        ))}
      </ChipRow>

      {type === 'moved' && (
        <div style={{ marginTop: 16 }}>
          <TextField label="移転先（わかれば）" value={movedTo} onChange={setMovedTo} multiline rows={2} maxLength={120} showCount />
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>どうやって知った？</div>
      <ChipRow style={{ marginTop: 8 }}>
        {HOW_KNOWN.map((h) => (
          <ChoiceChip key={h} selected={howKnown === h} onClick={() => setHowKnown(howKnown === h ? null : h)}>
            {h}
          </ChoiceChip>
        ))}
      </ChipRow>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>写真かリンク</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>なくてもよい</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <TextField label="リンク" value={evidence} onChange={setEvidence} placeholder="https://…" inputMode="url" />
      </div>
    </Sheet>
  );
}

// =============================================================
// ㉓-14〜20 通報する（お店・写真・タグ・ひとこと）
// =============================================================
export function ReportSheet({ kind, shop, target, targetLabel, onClose, onBlock }) {
  const reasons = REPORT_REASONS[kind] || REPORT_REASONS.shop;
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const other = reason === 'その他';

  if (done) {
    return (
      <Sheet title={REPORT_TITLE[kind]} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>閉じる</Button>}>
        <Done title="通報を受け付けました" body="内容を確認して対応します" />
        {onBlock && (
          <Button variant="secondary" onClick={onBlock} style={{ marginTop: 16 }}>
            投稿した人をブロックする
          </Button>
        )}
      </Sheet>
    );
  }

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await submitShopReport({ kind, shopId: shop.id, targetId: target, reason, detail: other ? detail.trim() : null });
      setDone(true);
    } catch (e) {
      setError(reportErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  // 「その他」：その場で書く（㉓-15）
  if (other) {
    return (
      <Sheet
        title={REPORT_TITLE[kind]}
        sub={targetLabel}
        onBack={() => setReason(null)}
        onClose={onClose}
        footer={
          <>
            {error && <p role="alert" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>}
            <Button variant="primary" onClick={send} disabled={detail.trim() === '' || sending}>
              {sending ? '送っています' : '送信する'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>その他</span>
          <button type="button" onClick={() => setReason(null)} className="ui-btn" style={{ height: 36, padding: '0 12px', border: 0, background: 'transparent', color: color.sub, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            理由を変える
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <TextField label="" value={detail} onChange={setDetail} multiline rows={4} maxLength={REPORT_DETAIL_MAX} showCount />
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={REPORT_TITLE[kind]}
      sub={targetLabel}
      onClose={onClose}
      footer={
        <>
          {error && <p role="alert" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>}
          <Button variant="primary" onClick={send} disabled={!reason || sending}>
            {sending ? '送っています' : '送信する'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '4px 0 10px', fontSize: 13, fontWeight: 700, color: color.sub }}>あてはまるものを1つ選んでください</p>
      <div role="radiogroup" style={{ borderBottom: `1px solid ${color.line}` }}>
        {reasons.map((r) => {
          const on = reason === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setReason(r)}
              className="ui-btn"
              style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: on ? 700 : 500 }}>{r}</span>
              <span aria-hidden="true" style={{ position: 'relative', flex: 'none', width: 24, height: 24, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%' }}>
                {on && <span style={{ position: 'absolute', left: 5, top: 5, width: 10, height: 10, borderRadius: '50%', background: color.ink }} />}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export { FIELD_GROUPS };
