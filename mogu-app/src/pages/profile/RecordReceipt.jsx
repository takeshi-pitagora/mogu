import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import Dig from '../../components/ui/Dig';
import logo from '../../assets/brand/mogu_logo_black.png';
import { myRecord, myRecordMonths } from '../../lib/record';
import MonthImageSheet from './MonthImageSheet';

// =============================================================
// ③-3〜5・8 記録のレシート
//   月のタブ（新しい順＋いちばん右に［通算］）と、レシートの形のカード。
//   新しく見つけたお店・いちばん行ったエリア（上から3つ）・夜と昼のひとり平均・
//   dig の上がり幅・バーコードと mogu。下に［○月のまとめを画像にする］
// =============================================================

// レシートらしく見せるためのバーコード（確定版と同じ並び）
const BARS = [2, 2, 1, 3, 3, 1, 1, 2, 2, 3, 1, 1, 3, 2, 1, 3, 2, 1, 1, 2, 3, 3, 1, 1, 2, 2, 1, 3, 2, 1, 3, 2, 1, 1, 2, 3, 2, 2, 1, 1, 2, 3];

const yen = (n) => (n == null ? null : `¥${Number(n).toLocaleString('ja-JP')}`);
const ym = (iso) => { const [y, m] = String(iso).split('-'); return `${y}.${m}`; };
const md = (iso) => { const [, m, d] = String(iso).split('-'); return `${m}.${d}`; };

function Row({ label, value, big }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
      <span aria-hidden="true" style={{ flex: 1, borderBottom: `2px dotted ${color.lineStrong}`, transform: 'translateY(-4px)' }} />
      <span style={{ fontFamily: font.dela, fontSize: big ? 22 : 17, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export default function RecordReceipt({ onRegister }) {
  const [months, setMonths] = useState(null);
  const [pick, setPick] = useState(0); // 0 = いちばん新しい月、months.length = 通算
  const [data, setData] = useState(null);
  const [share, setShare] = useState(false);

  useEffect(() => {
    let alive = true;
    myRecordMonths()
      .then((rows) => alive && setMonths(rows))
      .catch(() => alive && setMonths([]));
    return () => { alive = false; };
  }, []);

  const month = months && pick < months.length ? months[pick] : null;
  const whole = !!months && pick >= months.length;

  useEffect(() => {
    if (!months) return undefined;
    let alive = true;
    myRecord(whole ? null : month)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [months, month, whole]);

  if (!months) return null;

  const empty = data && data.found === 0 && (data.areas || []).length === 0 && data.dinner == null && data.lunch == null;
  const thisMonth = months[0];
  const monthLabel = (iso) => { const [y, m] = String(iso).split('-'); return pick === 0 && iso === thisMonth ? `${y}年${Number(m)}月` : `${Number(m)}月`; };

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>記録</h2>
      </div>

      {empty ? (
        <div style={{ marginTop: 18, padding: '22px 18px', borderRadius: 22, background: color.surface, textAlign: 'center' }}>
          <div style={{ fontFamily: font.dela, fontSize: 17 }}>記録はまだありません</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.65, color: color.sub }}>
            お店に行った記録がたまると、新しく見つけたお店・よく行くエリア・夜と昼の平均がここに出ます
          </p>
          <div style={{ width: 220, margin: '14px auto 0' }}>
            <button type="button" className="ui-btn ui-btn--primary" onClick={onRegister} style={{ width: '100%', minHeight: 48, boxSizing: 'border-box', padding: '0 16px', border: 0, borderRadius: 24, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              お店を登録する
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ height: 14 }} />
          <div style={{ margin: '0 -16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderBottom: `1px solid ${color.line}`, scrollbarWidth: 'none' }}>
            <div style={{ display: 'flex', gap: 22, padding: '0 16px' }}>
              {months.map((m, i) => (
                <button key={m} type="button" className="ui-btn" onClick={() => setPick(i)} aria-pressed={pick === i} style={{ flex: 'none', height: 44, padding: '0 4px', boxSizing: 'border-box', border: 0, borderBottom: `3px solid ${pick === i ? color.ink : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: pick === i ? color.ink : color.sub }}>
                  {monthLabel(m)}
                </button>
              ))}
              <button type="button" className="ui-btn" onClick={() => setPick(months.length)} aria-pressed={whole} style={{ flex: 'none', height: 44, padding: '0 4px', boxSizing: 'border-box', border: 0, borderBottom: `3px solid ${whole ? color.ink : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: whole ? color.ink : color.sub }}>
                通算
              </button>
            </div>
          </div>

          {data && (
            <div style={{ marginTop: 14, padding: '18px 18px 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '6px 6px 18px 18px', background: color.white }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: font.dela, fontSize: 22 }}>
                  {whole ? 'これまでの記録' : `${String(month).split('-')[0]}年${Number(String(month).split('-')[1])}月`}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: color.sub }}>
                  {whole ? `${ym(data.from)} — ${ym(data.to)}` : `${String(data.from).replaceAll('-', '.')} — ${md(data.to)}`}
                </div>
              </div>
              <div style={{ marginTop: 12, borderTop: `2px dashed ${color.ink}` }} />

              <Row label="新しく見つけたお店" value={`${data.found}店`} big />

              {(data.areas || []).length > 0 && (
                <>
                  <Row label="いちばん行ったエリア" value={`${data.areas[0].name} ×${data.areas[0].n}`} />
                  {data.areas.slice(1).map((a, i) => (
                    <div key={a.name} style={{ margin: '4px 0 0 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: color.sub }}>
                      <span>{i + 2}. {a.name}</span>
                      <span>×{a.n}</span>
                    </div>
                  ))}
                </>
              )}

              {data.dinner != null && <Row label="夜のひとり平均" value={yen(data.dinner)} />}
              {data.lunch != null && <Row label="昼のひとり平均" value={yen(data.lunch)} />}

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `2px dashed ${color.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>dig の上がり幅</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Dig n={data.dig_from} size={15.5} muted />
                  <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" style={{ flex: 'none' }}>
                    <path d="M1 6h14M11 1.5 15.5 6 11 10.5" fill="none" stroke={color.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <Dig n={data.dig_to} size={18.9} />
                </span>
              </div>

              <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <span aria-hidden="true" style={{ display: 'flex' }}>
                  {BARS.map((w, i) => (
                    <span key={i} style={{ width: w, height: i % 2 === 0 ? 26 : undefined, background: i % 2 === 0 ? color.ink : undefined }} />
                  ))}
                </span>
                <img src={logo} alt="mogu" style={{ display: 'block', height: 20 }} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setShare(true)} style={{ width: '100%', height: 52, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
              {`${Number(String(thisMonth).split('-')[1])}月のまとめを画像にする`}
            </button>
          </div>
        </>
      )}

      {share && <MonthImageSheet month={thisMonth} onClose={() => setShare(false)} />}
    </div>
  );
}
