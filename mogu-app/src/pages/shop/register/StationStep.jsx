import { useEffect, useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { searchStations } from '../../../lib/shops';
import { WALK_MIN_MAX } from '../../../lib/registerForm';
import Icon from '../../../components/ui/Icon';
import StepFrame from './StepFrame';

// ⑱-1 必須1：最寄駅と徒歩（確定版 Final-18 の1）
//   アプリに入れた東京の駅の一覧から探して選ぶ（近い駅の自動の候補は出さない）
//   徒歩の分数は自分で入れる
export default function StationStep({ form, onChange, onOpenPicker }) {
  const picked = form.station;
  return (
    <StepFrame form={form} title="最寄駅と、駅から歩く時間は？">
      <div style={{ flex: 'none', marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onOpenPicker}
          className="ui-btn"
          style={{
            flex: 1,
            minWidth: 0,
            height: 56,
            boxSizing: 'border-box',
            padding: '0 12px 0 16px',
            border: `${stroke.shape}px solid ${color.ink}`,
            borderRadius: 18,
            background: color.white,
            color: picked ? color.ink : color.sub,
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: picked ? 700 : 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textAlign: 'left',
          }}
        >
          <Icon name="train" size={20} color={picked ? color.ink : color.sub} />
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {picked ? `${picked.name}駅` : '駅を選ぶ'}
          </span>
          <Icon name="chevronRight" size={18} color={color.sub} />
        </button>

        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>徒歩</span>
          <WalkInput value={form.walkMin} onChange={(v) => onChange({ walkMin: v })} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>分</span>
        </div>
      </div>
    </StepFrame>
  );
}

// 徒歩の分数（64×56の小さな欄。入れていないときは「—」）
function WalkInput({ value, onChange }) {
  const empty = String(value ?? '') === '';
  return (
    <div
      style={{
        position: 'relative',
        width: 64,
        height: 56,
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 700,
        color: empty ? color.sub : color.ink,
      }}
    >
      {empty && (
        <span aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
          —
        </span>
      )}
      <input
        aria-label="駅から歩く時間（分）"
        type="number"
        inputMode="numeric"
        min={0}
        max={WALK_MIN_MAX}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange('');
          const n = Math.max(0, Math.min(WALK_MIN_MAX, Math.floor(Number(raw))));
          return onChange(Number.isFinite(n) ? String(n) : '');
        }}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          outline: 0,
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          textAlign: 'center',
          padding: 0,
        }}
      />
    </div>
  );
}

// ⑱-2 駅を選ぶ（東京の駅の一覧から探す）
//   上のシートの上にもう1枚出す。［キャンセル］「最寄駅」
export function StationPicker({ onPick, onCancel }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const timer = useRef(null);
  const seq = useRef(0);
  const box = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const list = await searchStations(q, 60);
        if (seq.current === mine) {
          setRows(list);
          setFailed(false);
          setLoading(false);
        }
      } catch {
        if (seq.current === mine) {
          setRows([]);
          setFailed(true);
          setLoading(false);
        }
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer.current);
  }, [q]);

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 11 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="最寄駅"
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
          zIndex: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <button
            type="button"
            onClick={onCancel}
            className="ui-btn"
            style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}
          >
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>最寄駅</h2>
          <span style={{ width: 70 }} />
        </div>

        <div
          role="search"
          onClick={() => box.current?.focus()}
          style={{
            flex: 'none',
            marginTop: 4,
            minHeight: 56,
            boxSizing: 'border-box',
            padding: '4px 15px',
            border: `${stroke.focus}px solid ${color.ink}`,
            borderRadius: 18,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="search" size={20} color={color.sub} />
          <input
            ref={box}
            aria-label="駅をさがす"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="駅をさがす"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: color.ink, padding: 0 }}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px' }}>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: color.sub }}>東京の駅</div>
          {rows.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onPick(st)}
              className="ui-btn"
              style={{
                width: '100%',
                height: 56,
                padding: 0,
                border: 0,
                borderBottom: `1px solid ${color.line}`,
                background: 'transparent',
                color: color.ink,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {st.name}駅
              </span>
              {st.ward && <span style={{ flex: 'none', fontSize: 12, color: color.sub }}>{st.ward}</span>}
            </button>
          ))}
          {!loading && rows.length === 0 && (
            <p style={{ margin: '18px 0 0', fontSize: 13, fontWeight: 700, lineHeight: 1.6, color: color.sub }}>
              {failed ? 'いま駅の一覧を読めませんでした。' : '見つかりませんでした。打ち方を変えてみてください。'}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
