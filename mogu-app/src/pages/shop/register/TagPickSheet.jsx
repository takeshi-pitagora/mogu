import { useEffect, useMemo, useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { tagNameError } from '../../../lib/tags';
import { createTag, searchTags, suggestTags } from '../../../lib/shops';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ⑲ ハッシュタグを付ける（確定版 Final-19）
//   ・何も打っていないとき：種類ごとに、よく使われるタグほど大きく
//   ・打つと：お店の数つきの1行ずつの一覧（ひらがな・カタカナ・英字どれでも同じ）
//   ・候補にないとき：いちばん下に「新しいタグ『#○○』を作る」
//   ・1人が1つのお店に付けられるのは5つまで
// =============================================================

export const TAG_PER_SHOP_MAX = 5;

// 候補の大きさ（90店以上が大、50店以上が中）
const BIG_AT = 90;
const MID_AT = 50;
function sizeOf(count) {
  const n = Number(count) || 0;
  if (n >= BIG_AT) return 'big';
  if (n >= MID_AT) return 'mid';
  return 'small';
}

const SIZE = {
  big: { height: 61, padding: '0 20px', borderRadius: 30, fontFamily: font.dela, fontSize: 22, fontWeight: 400 },
  mid: { height: 50, padding: '0 18px', borderRadius: 25, fontSize: 18, fontWeight: 500 },
  small: { height: 44, padding: '0 14px', borderRadius: 22, fontSize: 14, fontWeight: 500 },
};

function TagChip({ name, count, selected, onClick, size }) {
  const s = SIZE[size || sizeOf(count)];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        background: selected ? color.ink : color.white,
        color: selected ? color.white : color.ink,
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        ...s,
      }}
    >
      #{name}
    </button>
  );
}

export default function TagPickSheet({ picked, onDone, onCancel }) {
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState(picked || []);
  const [groups, setGroups] = useState(null); // 何も打っていないときの候補
  const [result, setResult] = useState({ q: null, rows: [] });
  const [making, setMaking] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const timer = useRef(null);
  const seq = useRef(0);

  const typed = q.trim().replace(/^#/, '');
  const over = chosen.length >= TAG_PER_SHOP_MAX;

  useEffect(() => {
    box.current?.focus();
    suggestTags(8)
      .then((rows) => {
        const by = new Map();
        rows.forEach((r) => {
          if (!by.has(r.category)) by.set(r.category, []);
          by.get(r.category).push(r);
        });
        setGroups([...by.entries()]);
      })
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (typed === '') return undefined;
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const rows = await searchTags(typed, 20);
        if (seq.current === mine) setResult({ q: typed, rows });
      } catch {
        if (seq.current === mine) setResult({ q: typed, rows: [] });
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [typed]);

  // 古い問い合わせの結果は見せない
  const fresh = typed !== '' && result.q === typed;
  const hits = fresh ? result.rows : [];
  const searching = typed !== '' && !fresh;

  const toggle = (tag) => {
    setError(null);
    if (chosen.some((t) => t.id === tag.id)) {
      setChosen(chosen.filter((t) => t.id !== tag.id));
    } else if (over) {
      setError(`1つのお店に付けられるタグは、1人${TAG_PER_SHOP_MAX}つまでです`);
    } else {
      setChosen([...chosen, tag]);
    }
  };

  // 候補にないときの「新しいタグを作る」
  const nameError = useMemo(() => (typed === '' ? null : tagNameError(typed)), [typed]);
  const exact = hits.some((h) => h.name === typed);
  const canMake = typed !== '' && !exact && !searching;

  const make = async () => {
    setError(null);
    if (nameError) {
      setError(
        nameError === 'tooShort' ? '2文字以上にしてください'
          : nameError === 'tooLong' ? '15文字までです'
            : '空白と記号は使えません（「ー」「・」「&」は使えます）',
      );
      return;
    }
    if (over) {
      setError(`1つのお店に付けられるタグは、1人${TAG_PER_SHOP_MAX}つまでです`);
      return;
    }
    setMaking(true);
    try {
      const tag = await createTag(typed);
      setChosen([...chosen, tag]);
      setQ('');
    } catch (e) {
      const raw = String(e?.message || '');
      setError(
        raw.includes('banned_word') ? '使えない言葉が含まれています'
          : raw.includes('tag_chars') ? '空白と記号は使えません（「ー」「・」「&」は使えます）'
            : raw.includes('tag_length') ? '2〜15文字にしてください'
              : 'いま作れませんでした。少し待ってもう一度お願いします。',
      );
    } finally {
      setMaking(false);
    }
  };

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="ハッシュタグ"
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
          zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onCancel} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>ハッシュタグ</h2>
          <button type="button" onClick={() => onDone(chosen)} className="ui-btn" style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
            完了
          </button>
        </div>

        {/* 選んだタグ */}
        {chosen.length > 0 && (
          <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {chosen.map((t) => (
              <TagChip key={t.id} name={t.name} selected size="small" onClick={() => toggle(t)} />
            ))}
          </div>
        )}

        {/* 「#」の入力欄 */}
        <div
          onClick={() => box.current?.focus()}
          style={{
            flex: 'none',
            minHeight: 56,
            boxSizing: 'border-box',
            padding: '4px 15px',
            border: `${stroke.focus}px solid ${color.ink}`,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: color.sub }}>#</span>
          <input
            ref={box}
            aria-label="ハッシュタグをさがす"
            value={q}
            onChange={(e) => {
              setQ(e.target.value.replace(/^#/, ''));
              setError(null);
            }}
            placeholder="タグをさがす"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: color.ink, padding: 0 }}
          />
        </div>

        <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, minHeight: 18 }}>
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: error ? color.red : color.sub }}>
            {error || (chosen.length > 0 ? `${chosen.length}/${TAG_PER_SHOP_MAX}` : '')}
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px 12px' }}>
          {typed === '' ? (
            // 何も打っていないとき：種類ごとに、よく使われるタグほど大きく
            (groups || []).map(([cat, rows]) => (
              <div key={cat} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>{cat}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {rows.map((t) => (
                    <TagChip key={t.id} name={t.name} count={t.shop_count} selected={chosen.some((c) => c.id === t.id)} onClick={() => toggle(t)} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              {hits.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
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
                  <span style={{ minWidth: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    #{t.name}
                  </span>
                  <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>{t.shop_count}店</span>
                    {chosen.some((c) => c.id === t.id) && <Icon name="check" size={18} />}
                  </span>
                </button>
              ))}

              {canMake && (
                <button
                  type="button"
                  onClick={make}
                  disabled={making}
                  className="ui-btn"
                  style={{
                    width: '100%',
                    minHeight: 56,
                    marginTop: 4,
                    padding: '0 2px',
                    border: 0,
                    background: 'transparent',
                    color: color.ink,
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  新しいタグ「#{typed}」を作る
                </button>
              )}

              {canMake && (
                <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
                  料理とドリンクは、ものの名前だけがおすすめです（例：#フルーツサワー、#担々麺）
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
