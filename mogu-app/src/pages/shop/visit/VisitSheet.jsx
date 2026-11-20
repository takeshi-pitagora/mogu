import { useEffect, useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { BUDGET_BUCKETS, HIGHLIGHTS } from '../../../lib/registerForm';
import { myLastVisit, shopFieldToConfirm, submitVisitStamp, visitError } from '../../../lib/visit';
import { GUIDE, chara } from '../../../lib/chara';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import Icon from '../../../components/ui/Icon';
import { VisitCalendar as VisitCalendarSheet } from '../register/VisitBudgetStep';
import VisitStamp from '../../../components/ui/VisitStamp';
import { stampDate } from '../../../lib/visitStamp';
import ConfirmFieldStep from './ConfirmFieldStep';

// =============================================================
// ㉒-4〜12 ハリーの1枚のアンケート → 来店スタンプ
//   上の見出しはなし。ハリーはシートの右上のふち。
//   押す前のスタンプの見本は出さない。
// =============================================================

const COMMENT_MAX = 140;

function jstToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

function Num({ n, children }) {
  return (
    <h3 style={{ margin: '0 0 10px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: font.dela, fontSize: 15, color: color.accent }}>{n}</span>
      <span style={{ fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>{children}</span>
    </h3>
  );
}

export default function VisitSheet({ shop, onClose, onDone, onAskEdit }) {
  const today = jstToday();
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  const [when, setWhen] = useState(iso(today));
  const [cal, setCal] = useState(false);
  const [highs, setHighs] = useState([]);
  const [time, setTime] = useState(null);
  const [bucket, setBucket] = useState(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null); // 2回目に行ったとき（㉒-11）
  const [result, setResult] = useState(null); // 押したスタンプ
  const [confirmField, setConfirmField] = useState(null); // ㉒-12
  const box = useRef(null);

  useEffect(() => {
    let alive = true;
    myLastVisit(shop.id)
      .then((v) => alive && setLast(v))
      .catch(() => {});
    return () => { alive = false; };
  }, [shop.id]);

  const bad = comment.length > COMMENT_MAX;
  const can = highs.length >= 1 && !bad;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const stamp = await submitVisitStamp({
        shopId: shop.id,
        visitedOn: when,
        highlights: highs,
        budgetTime: time,
        budgetBucket: bucket,
        comment: comment.trim() || null,
      });
      // 2回目からは、アンケートのあとに情報の確認を1問（㉒-12）
      if (!stamp.first_time) {
        const f = await shopFieldToConfirm(shop.id).catch(() => null);
        if (f) setConfirmField(f);
      }
      setResult(stamp);
    } catch (e) {
      setError(visitError(e));
    } finally {
      setSending(false);
    }
  };

  // ㉒-8・9 来店スタンプゲット！
  if (result) {
    return (
      <StampResult
        stamp={result}
        shop={shop}
        highs={highs}
        time={time}
        bucket={bucket}
        hasComment={comment.trim() !== ''}
        confirmField={confirmField}
        onConfirmDone={() => setConfirmField(null)}
        onAskEdit={onAskEdit}
        onClose={() => onDone?.(result)}
      />
    );
  }

  const h = chara(GUIDE.harry);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} onClick={onClose} />
      {/* ハリーはシートの右上のふちに立つ */}
      <img
        src={h?.framed}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', right: 6, top: 88, width: 150, height: 196, objectFit: 'contain', objectPosition: 'center bottom', zIndex: 15, pointerEvents: 'none' }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="ここ行ったことある？"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 240,
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '18px 20px 0' }}>
          {/* 2回目に行ったとき：前のスタンプと今日の日付だけ（㉒-11） */}
          {last && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <VisitStamp code={last.stamp_character} name={shop.name} date={stampDate(last.visited_on)} size={54} />
              <span style={{ fontSize: 14, fontWeight: 500, color: color.sub }}>
                前に行ったのは {stampDate(last.visited_on)}
              </span>
            </div>
          )}

          <Num n="1">いつ行った？</Num>
          <ChipRow>
            <ChoiceChip selected={when === iso(today)} onClick={() => setWhen(iso(today))}>
              今日（{md(today)}）
            </ChoiceChip>
            <ChoiceChip selected={when === iso(yest)} onClick={() => setWhen(iso(yest))}>
              昨日（{md(yest)}）
            </ChoiceChip>
            <ChoiceChip selected={when !== iso(today) && when !== iso(yest)} onClick={() => setCal(true)}>
              {when !== iso(today) && when !== iso(yest) ? when.replace(/^\d{4}-/, '').replace('-', '/') : '日付を選ぶ'}
            </ChoiceChip>
          </ChipRow>

          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Num n="2">何がよかった？</Num>
              <span style={{ fontSize: 14, fontWeight: 700, color: color.sub }}>{highs.length}/2</span>
            </div>
            <p style={{ margin: '-6px 0 10px', fontSize: 13, fontWeight: 500, color: color.sub }}>8つから1〜2つ</p>
            <ChipRow>
              {HIGHLIGHTS.map((o) => {
                const on = highs.includes(o.key);
                return (
                  <ChoiceChip
                    key={o.key}
                    selected={on}
                    dim={!on && highs.length >= 2}
                    onClick={() => setHighs(on ? highs.filter((x) => x !== o.key) : highs.length < 2 ? [...highs, o.key] : highs)}
                  >
                    {o.label}
                  </ChoiceChip>
                );
              })}
            </ChipRow>
          </div>

          <div style={{ marginTop: 26 }}>
            <Num n="3">いくら使った？</Num>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>時間</span>
              <ChipRow style={{ flex: 1 }}>
                <ChoiceChip selected={time === 'lunch'} onClick={() => setTime(time === 'lunch' ? null : 'lunch')}>昼</ChoiceChip>
                <ChoiceChip selected={time === 'dinner'} onClick={() => setTime(time === 'dinner' ? null : 'dinner')}>夜</ChoiceChip>
              </ChipRow>
            </div>
            <p style={{ margin: '16px 0 10px', fontSize: 15, fontWeight: 700 }}>ひとりいくら？</p>
            <ChipRow>
              {BUDGET_BUCKETS.map((b) => (
                <ChoiceChip key={b.value} selected={bucket === b.value} onClick={() => setBucket(bucket === b.value ? null : b.value)}>
                  {b.label}
                </ChoiceChip>
              ))}
            </ChipRow>
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Num n="4">ひとこと</Num>
              <span style={{ fontSize: 14, fontWeight: 700, color: bad ? color.red : color.sub }}>{comment.length}/{COMMENT_MAX}</span>
            </div>
            <p style={{ margin: '-6px 0 10px', fontSize: 13, fontWeight: 500, color: color.sub }}>なくてもいい</p>
            <textarea
              ref={box}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="このお店のいいところ"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                border: `${stroke.focus}px solid ${bad ? color.red : color.ink}`,
                borderRadius: 20,
                font: 'inherit',
                fontSize: 16,
                lineHeight: 1.6,
                resize: 'none',
              }}
            />
            {bad && (
              <p style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: color.red }}>
                <Icon name="warning" size={16} color={color.red} />
                {COMMENT_MAX}字までです
              </p>
            )}
          </div>

          {error && (
            <p style={{ margin: '16px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: color.red }}>
              <Icon name="warning" size={17} color={color.red} />
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!can || sending}
          className="ui-btn"
          style={{
            flex: 'none',
            width: '100%',
            height: 60,
            marginTop: 14,
            border: 0,
            borderRadius: 30,
            background: !can || sending ? color.lineStrong : color.ink,
            color: color.white,
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          来店スタンプを押す
          {!last && <span style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>+1</span>}
        </button>
      </section>

      {cal && (
        <VisitCalendarSheet
          value={when}
          onDone={(v) => { setWhen(v); setCal(false); }}
          onCancel={() => setCal(false)}
        />
      )}
    </>
  );
}

// ㉒-8・9・12 来店スタンプゲット！
function StampResult({ stamp, shop, highs, time, bucket, hasComment, confirmField, onConfirmDone, onAskEdit, onClose }) {
  const budget = time && bucket
    ? `${time === 'lunch' ? '昼' : '夜'}・${BUDGET_BUCKETS.find((b) => b.value === bucket)?.label || ''}`
    : 'なし';
  const d = new Date(stamp.visited_on);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  if (confirmField) {
    return <ConfirmFieldStep shop={shop} field={confirmField} onDone={onConfirmDone} onAskEdit={onAskEdit} />;
  }

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="来店スタンプゲット！"
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

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginTop: 20 }}>
          <VisitStamp code={stamp.stamp_character} name={shop.name} date={stampDate(stamp.visited_on)} size={150} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 10 }}>
            <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.35 }}>
              来店スタンプ{'\n'}ゲット！
            </h2>
          </div>
        </div>

        <dl style={{ margin: '22px 0 0', padding: 0 }}>
          <Line k="行った日" v={`${d.getMonth() + 1}月${d.getDate()}日（${wd}）`} />
          <Line k="よかった" v={highs.map((k) => HIGHLIGHTS.find((h) => h.key === k)?.label || k).join('・') || 'なし'} />
          <Line k="予算" v={budget} />
          <Line k="ひとこと" v={hasComment ? 'あり' : 'なし'} last />
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="ui-btn"
          style={{ width: '100%', height: 60, marginTop: 22, border: 0, borderRadius: 30, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 17, fontWeight: 700 }}
        >
          お店のページに戻る
        </button>
        <button
          type="button"
          onClick={() => onClose({ addPhoto: true })}
          className="ui-btn"
          style={{ width: '100%', height: 56, marginTop: 10, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
        >
          写真も足す
        </button>
      </section>
    </>
  );
}

function Line({ k, v, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, minHeight: 52, borderBottom: last ? 0 : `1px solid ${color.line}` }}>
      <dt style={{ fontSize: 15, fontWeight: 500, color: color.sub }}>{k}</dt>
      <dd style={{ margin: 0, fontSize: 17, fontWeight: 700, textAlign: 'right' }}>{v}</dd>
    </div>
  );
}
