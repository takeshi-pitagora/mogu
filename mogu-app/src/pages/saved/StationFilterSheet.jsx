import { useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import Icon from '../../components/ui/Icon';

// =============================================================
// ㉕-6〜12 ［駅］のシート「駅で絞る」（確定版 Final-25 の 6〜12）
//   駅名で探す欄・「近くの駅も含める（歩いて15分ほどの駅も）」・
//   保存したお店の駅（多い順・数つき・1つだけ選ぶ）・［外す］［○件を見る］
//   出すのは保存したお店の駅だけ。近くの駅は選んだ駅から1.2km以内（引き渡し書 §6-9）
// =============================================================

export default function StationFilterSheet({
  open, stations, value, nearby, near0 = [], countFor, getNear, onApply, onClear, onClose,
}) {
  const [pick, setPick] = useState(value || null);
  const [near, setNear] = useState(!!nearby);
  const [nearNames, setNearNames] = useState(near0);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const t = q.trim();
    return t === '' ? stations : stations.filter((s) => s.name.includes(t));
  }, [stations, q]);

  // 駅を選んだときに、近くの駅をその場でもらう（出すときに1回だけ読まないで済む）
  const choose = async (name) => {
    const next = pick === name ? null : name;
    setPick(next);
    if (!next) {
      setNearNames([]);
      return;
    }
    try {
      const rows = await getNear(next);
      setNearNames(rows);
    } catch {
      setNearNames([]);
    }
  };

  const count = countFor(pick, near ? nearNames : []);
  const nearText = near && nearNames.length > 0 ? `歩いて15分ほどの駅も（${nearNames.join('・')}）` : '歩いて15分ほどの駅も';

  const rowSel = { width: '100%', minHeight: 54, padding: 0, border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: font.plex, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' };

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="駅で絞る" height="calc(100% - 96px)" maxHeight="none" padding="10px 20px 34px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px', flex: 'none' }}>
        <button type="button" onClick={onClose} className="ui-btn ui-btn--text" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: font.plex, fontSize: 15, fontWeight: 500 }}>
          キャンセル
        </button>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>駅で絞る</h2>
        <span style={{ width: 74 }} />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', height: 48, marginTop: 4, boxSizing: 'border-box', padding: '0 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={18} color={color.sub} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="駅名で探す"
            aria-label="駅名で探す"
            style={{ flex: 1, minWidth: 0, height: 44, border: 0, outline: 'none', background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, padding: 0 }}
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={near}
          onClick={() => setNear(!near)}
          className="ui-btn"
          style={{ flex: 'none', width: '100%', minHeight: 60, marginTop: 12, boxSizing: 'border-box', padding: '8px 12px 8px 14px', border: 0, borderRadius: 18, background: color.surface, color: color.ink, fontFamily: font.plex, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>近くの駅も含める</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>{nearText}</span>
          </span>
          <span aria-hidden="true" style={{ flex: 'none', position: 'relative', width: 52, height: 32, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 16, background: color.white }}>
            <span style={{ position: 'absolute', top: 2, left: near ? 22 : 2, width: 24, height: 24, borderRadius: '50%', background: color.ink }} />
          </span>
        </button>

        <p style={{ flex: 'none', margin: '14px 0 0', fontSize: 12, fontWeight: 700, color: color.sub }}>保存したお店の駅（多い順）</p>

        <div role="radiogroup" aria-label="保存したお店の駅" style={{ flex: '1 1 auto', minHeight: 0, marginTop: 4, borderTop: `1px solid ${color.line}`, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {list.map((s) => (
            <button key={s.name} type="button" role="radio" aria-checked={pick === s.name} onClick={() => choose(s.name)} className="ui-btn" style={rowSel}>
              <Icon name="train" size={18} color={color.sub} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: pick === s.name ? 700 : 500 }}>{s.name}</span>
              <span style={{ fontSize: 13, color: color.sub }}>{s.n}件</span>
              <span aria-hidden="true" style={{ position: 'relative', flex: 'none', width: 24, height: 24, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%' }}>
                {pick === s.name && <span style={{ position: 'absolute', left: 5, top: 5, width: 10, height: 10, borderRadius: '50%', background: color.ink }} />}
              </span>
            </button>
          ))}
          {list.length === 0 && <p style={{ margin: '20px 0 0', fontSize: 15, fontWeight: 500, color: color.sub }}>その駅の保存したお店はありません</p>}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 10, paddingTop: 12, borderTop: `1px solid ${color.line}` }}>
        <button type="button" onClick={onClear} className="ui-btn ui-btn--secondary" style={{ flex: '1 1 0px', height: 52, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: color.white, color: color.ink, fontFamily: font.plex, fontSize: 15, fontWeight: 700 }}>
          外す
        </button>
        <button type="button" onClick={() => onApply(pick, near, nearNames)} className="ui-btn ui-btn--primary" style={{ flex: '1.4 1 0px', height: 52, border: 0, borderRadius: 26, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 15, fontWeight: 700 }}>
          <span style={{ fontFamily: font.dela }}>{count}</span>
          件を見る
        </button>
      </div>
    </BottomSheet>
  );
}
