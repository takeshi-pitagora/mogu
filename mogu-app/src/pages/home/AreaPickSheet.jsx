import { useEffect, useRef, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { searchStations, stationWards, stationsInWard } from '../../lib/shops';
import Icon from '../../components/ui/Icon';

// =============================================================
// ㉔-10〜12 区から選ぶ（東京23区・市部 → 駅）／駅名で探す
// =============================================================

export default function AreaPickSheet({ mode, picked, onPick, onClose }) {
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState({ q: null, rows: [] });
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    if (mode !== 'ward') return undefined;
    let alive = true;
    stationWards().then((w) => alive && setWards(w)).catch(() => {});
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    if (!ward) return undefined;
    let alive = true;
    stationsInWard(ward).then((r) => alive && setRows(r)).catch(() => {});
    return () => { alive = false; };
  }, [ward]);

  const typed = q.trim();
  useEffect(() => {
    clearTimeout(timer.current);
    if (typed === '') return undefined;
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const r = await searchStations(typed, 20);
        if (seq.current === mine) setHits({ q: typed, rows: r });
      } catch {
        if (seq.current === mine) setHits({ q: typed, rows: [] });
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [typed]);

  const title = mode === 'ward' ? (ward || '区から選ぶ') : '駅名で探す';
  const list = mode === 'ward' ? (ward ? rows : wards) : (hits.q === typed ? hits.rows : []);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 15 }} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'absolute', left: 0, right: 0, top: 80, bottom: 0, boxSizing: 'border-box',
          padding: '10px 20px 34px', border: `${stroke.shape}px solid ${color.ink}`, borderBottom: 0,
          borderRadius: '32px 32px 0 0', background: color.white, display: 'flex', flexDirection: 'column', zIndex: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, margin: '0 -8px' }}>
          <button
            type="button"
            aria-label="戻る"
            onClick={ward ? () => setWard(null) : onClose}
            className="ui-btn"
            style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" size={24} />
          </button>
          <h2 style={{ margin: 0, flex: 1, textAlign: 'center', fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{title}</h2>
          <span style={{ width: 44 }} />
        </div>

        {mode === 'station' && (
          <div style={{ flex: 'none', minHeight: 56, boxSizing: 'border-box', padding: '4px 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="search" size={20} color={color.sub} />
            <input
              aria-label="駅名で探す"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="駅名を入れる"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: color.ink, padding: 0 }}
            />
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 10 }}>
          {mode === 'ward' && !ward
            ? list.map((w, i) => (
              <button
                key={w.ward}
                type="button"
                onClick={() => setWard(w.ward)}
                className="ui-btn"
                style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: i === 0 ? `1px solid ${color.line}` : 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
              >
                <span style={{ fontSize: 17, fontWeight: 700 }}>{w.ward}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: color.sub }}>
                  {w.n}駅
                  <Icon name="chevronRight" size={18} color={color.sub} />
                </span>
              </button>
            ))
            : list.map((st, i) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onPick(st)}
                className="ui-btn"
                style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: i === 0 ? `1px solid ${color.line}` : 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{st.name}</span>
                  {(st.ward || st.line) && (
                    <span style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 500, color: color.sub }}>
                      {[st.ward, st.line].filter(Boolean).join('・')}
                    </span>
                  )}
                </span>
                {picked?.includes(st.name) && <Icon name="check" size={20} />}
              </button>
            ))}
          {mode === 'station' && typed !== '' && list.length === 0 && (
            <p style={{ margin: '20px 0 0', fontSize: 15, fontWeight: 500, color: color.sub }}>その駅は見つかりませんでした</p>
          )}
        </div>
      </section>
    </>
  );
}
