import { useEffect, useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { shopPhotoUrl } from '../../lib/shops';

// =============================================================
// ③ 行ったお店のカレンダー（確定版 Final-03-Profile の2〜7）
//   行った日にお店の写真が入る。押すと、そのお店のページ（㉑）
//   「行った日」は、お店を登録した日と、来店スタンプの日
// =============================================================

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

function monthRange(d) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: key(from), to: key(to), days: to.getDate(), pad: from.getDay() };
}

export default function VisitCalendar({ onOpenShop }) {
  const [month, setMonth] = useState(() => new Date());
  // 読んだ結果は、どの月のものかを一緒に持つ（古い月の写真を見せないため）
  const [result, setResult] = useState({ from: null, rows: [] });

  const range = useMemo(() => monthRange(month), [month]);

  useEffect(() => {
    let alive = true;
    supabase
      .rpc('my_visit_calendar', { p_from: range.from, p_to: range.to })
      .then(({ data }) => {
        if (alive) setResult({ from: range.from, rows: data || [] });
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to]);

  const fresh = result.from === range.from;
  const loading = !fresh;
  const rows = fresh ? result.rows : [];

  const byDay = useMemo(() => {
    const m = new Map();
    if (result.from === range.from) {
      result.rows.forEach((r) => m.set(Number(String(r.visited_on).slice(8, 10)), r));
    }
    return m;
  }, [result, range.from]);

  const now = new Date();
  const canNext = month.getFullYear() < now.getFullYear()
    || (month.getFullYear() === now.getFullYear() && month.getMonth() < now.getMonth());

  const cells = [];
  for (let i = 0; i < range.pad; i += 1) cells.push(null);
  for (let d = 1; d <= range.days; d += 1) cells.push(d);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, paddingBottom: 6, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>行ったお店</h2>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Arrow dir="prev" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <span style={{ fontFamily: font.dela, fontSize: 17 }}>
            {month.getFullYear()}年{month.getMonth() + 1}月
          </span>
          <Arrow dir="next" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4, marginTop: 2 }}>
          {WEEK.map((w) => (
            <span key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: color.sub }}>
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d == null) return <span key={`p${i}`} style={{ height: 47 }} />;
            const hit = byDay.get(d);
            if (!hit) {
              return (
                <span key={d} style={{ width: 47, height: 47, margin: '0 auto', boxSizing: 'border-box', borderRadius: 12, background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: color.sub }}>
                  {d}
                </span>
              );
            }
            const url = shopPhotoUrl(hit.card_path);
            return (
              <button
                key={d}
                type="button"
                aria-label={`${month.getMonth() + 1}月${d}日 ${hit.shop_name}`}
                onClick={() => onOpenShop?.(hit.shop_id)}
                className="ui-btn"
                style={{ position: 'relative', display: 'block', width: 47, height: 47, margin: '0 auto', padding: 0, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 12, overflow: 'hidden', background: color.surface }}
              >
                {url && <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                <span style={{ position: 'absolute', left: 3, top: 3, minWidth: 16, height: 16, padding: '0 3px', boxSizing: 'border-box', borderRadius: 8, background: color.white, color: color.ink, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {d}
                </span>
              </button>
            );
          })}
        </div>

        {!loading && rows.length === 0 && (
          <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 13, fontWeight: 700, color: color.sub }}>
            この月は、まだ行ったお店がありません
          </p>
        )}
      </div>
    </section>
  );
}

function Arrow({ dir, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? '前の月' : '次の月'}
      disabled={disabled}
      onClick={onClick}
      className="ui-btn"
      style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: disabled ? color.lineStrong : color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
        <path d={dir === 'prev' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
      </svg>
    </button>
  );
}
