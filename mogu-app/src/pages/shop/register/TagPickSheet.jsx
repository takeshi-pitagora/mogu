import { useEffect, useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { TAG_NAME_MAX, TAG_NAME_MIN, tagNameError } from '../../../lib/tags';
import { createTag, searchTags, suggestTags } from '../../../lib/shops';
import { useToast } from '../../../components/ui/Toast';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ⑲ ハッシュタグを付ける（確定版 Final-19）
//   ・何も打っていないとき：種類ごとに、よく使われるタグほど大きく
//   ・打つと：お店の数つきの1行ずつの一覧（合っているところに下線）
//   ・候補にないとき：いちばん下に［＋ 新しいタグ「#○○」を作る］
//     → 押すと「新しいタグを作る」のシート（作る前に一度見せる）
//   ・1人が1つのお店に付けられるのは5つまで（超えたら黒い短い知らせ）
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

// 候補のチップ。選べないときは、ふちも地もクリーム（押せない見た目）
function TagChip({ name, count, selected, dim, onClick }) {
  const s = SIZE[sizeOf(count)];
  const look = selected
    ? { border: `${stroke.shape}px solid ${color.ink}`, background: color.ink, color: color.white }
    : dim
      ? { border: `${stroke.shape}px solid ${color.surface}`, background: color.surface, color: color.sub }
      : { border: `${stroke.shape}px solid ${color.ink}`, background: color.white, color: color.ink };
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        ...s,
        ...look,
      }}
    >
      #{name}
    </button>
  );
}

// 選んだタグ（黒いカプセル。右に×）
export function PickedChip({ name, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="ui-btn"
      aria-label={`#${name} を外す`}
      style={{
        flex: 'none',
        height: 40,
        boxSizing: 'border-box',
        padding: '0 16px',
        border: 0,
        borderRadius: 20,
        background: color.ink,
        color: color.white,
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
      }}
    >
      #{name}
      <Icon name="close" size={15} strokeWidth={2.5} />
    </button>
  );
}

// ひらがなでもカタカナでも同じに見るための形（1文字が1文字に変わるので、位置はずれない）
const kana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).toLowerCase();

// 打った言葉と合っているところに下線を引く（いちばん長く重なるところ）
function overlap(name, typed) {
  if (!typed) return null;
  const a = kana(name);
  const b = kana(typed);
  for (let len = Math.min(a.length, b.length); len >= 2; len -= 1) {
    for (let i = 0; i + len <= b.length; i += 1) {
      const at = a.indexOf(b.slice(i, i + len));
      if (at >= 0) return [at, at + len];
    }
  }
  return null;
}

function HitName({ name, typed }) {
  const m = overlap(name, typed);
  if (!m) return <>#{name}</>;
  return (
    <>
      #{name.slice(0, m[0])}
      <span style={{ textDecoration: 'underline', textUnderlineOffset: 4, textDecorationThickness: 2 }}>{name.slice(m[0], m[1])}</span>
      {name.slice(m[1])}
    </>
  );
}

const CHARS_TEXT = '空白・記号は使えません（「ー」「・」「&」は使えます）';

// 作る前に一度見せるシート
function NewTagSheet({ name, busy, error, onMake, onCancel }) {
  const lenOk = name.length >= TAG_NAME_MIN && name.length <= TAG_NAME_MAX;
  const charsOk = tagNameError(name) !== 'format';
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 15 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="新しいタグを作る"
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
          zIndex: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onCancel} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>新しいタグを作る</h2>
        </div>

        <div style={{ marginTop: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 18px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, fontSize: 16, fontWeight: 700 }}>
            #{name}
          </span>
        </div>

        <p style={{ margin: '14px 0 0', fontSize: 15, fontWeight: 500, lineHeight: 1.7 }}>
          作ったタグは、その時点でアプリのタグになります。ほかの人がタグを探したときにも、候補に出ます
        </p>

        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Rule ok={lenOk}>
            {TAG_NAME_MIN}〜{TAG_NAME_MAX}文字（いまは{name.length}文字）
          </Rule>
          <Rule ok={charsOk}>{CHARS_TEXT}</Rule>
        </ul>

        <div style={{ marginTop: 14, padding: '14px 14px', borderRadius: 20, background: color.surface }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'nowrap' }}>料理とドリンクは、ものの名前だけがおすすめです</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, whiteSpace: 'nowrap' }}>
            <span style={{ color: color.sub, fontWeight: 500 }}>#フルーツサワーが美味しい</span>
            <span aria-hidden="true" style={{ color: color.ink, fontWeight: 700 }}>→</span>
            <span style={{ fontWeight: 700 }}>#フルーツサワー</span>
          </div>
        </div>

        {error && (
          <p style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: color.red }}>
            <Icon name="warning" size={16} color={color.red} />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onMake}
          disabled={busy || !lenOk || !charsOk}
          className="ui-btn"
          style={{
            width: '100%',
            height: 60,
            marginTop: 18,
            border: 0,
            borderRadius: 30,
            background: busy || !lenOk || !charsOk ? color.lineStrong : color.ink,
            color: color.white,
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          このタグを作る
        </button>
      </section>
    </>
  );
}

function Rule({ ok, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: ok ? color.ink : color.red }}>
      <span style={{ flex: 'none', marginTop: 3 }}>
        <Icon name={ok ? 'check' : 'warning'} size={17} color={ok ? color.ink : color.red} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function TagPickSheet({ picked, max = TAG_PER_SHOP_MAX, overMessage, onDone, onCancel }) {
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState(picked || []);
  const [groups, setGroups] = useState(null); // 何も打っていないときの候補
  const [result, setResult] = useState({ q: null, rows: [] });
  const [making, setMaking] = useState(false);
  const [askNew, setAskNew] = useState(false);
  const [error, setError] = useState(null); // 入力欄の下に赤で出す
  const [makeError, setMakeError] = useState(null); // 「作る」のシートの中
  const box = useRef(null);
  const timer = useRef(null);
  const seq = useRef(0);
  const toast = useToast();

  const typed = q.trim().replace(/^#/, '');
  const over = chosen.length >= max;

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

  const tooMany = () => toast?.show(overMessage || `1つのお店に付けられるタグは、1人${max}つまでです`, { withTabBar: false });

  const toggle = (tag) => {
    setError(null);
    if (chosen.some((t) => t.id === tag.id)) {
      setChosen(chosen.filter((t) => t.id !== tag.id));
    } else if (over) {
      tooMany();
    } else {
      setChosen([...chosen, tag]);
    }
  };

  const exact = hits.some((h) => h.name === typed);
  const canMake = typed !== '' && !exact && !searching && !error;

  const openNew = () => {
    setMakeError(null);
    if (over) {
      tooMany();
      return;
    }
    setAskNew(true);
  };

  const make = async () => {
    setMakeError(null);
    setMaking(true);
    try {
      const tag = await createTag(typed);
      setChosen([...chosen, tag]);
      setQ('');
      setAskNew(false);
    } catch (e) {
      const raw = String(e?.message || '');
      if (raw.includes('banned_word')) {
        setAskNew(false);
        setError('banned');
      } else {
        setMakeError(
          raw.includes('tag_chars') ? CHARS_TEXT
            : raw.includes('tag_length') ? `${TAG_NAME_MIN}〜${TAG_NAME_MAX}文字にしてください`
              : 'いま作れませんでした。少し待ってもう一度お願いします。',
        );
      }
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
              <PickedChip key={t.id} name={t.name} onRemove={() => toggle(t)} />
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
            padding: '4px 16px',
            border: `${stroke.focus}px solid ${error ? color.red : color.ink}`,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span aria-hidden="true" style={{ fontFamily: font.dela, fontSize: 17, color: color.ink }}>#</span>
          <input
            ref={box}
            aria-label="ハッシュタグをさがす"
            value={q}
            onChange={(e) => {
              setQ(e.target.value.replace(/^#/, ''));
              setError(null);
            }}
            placeholder="タグを探す・作る"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: color.ink, padding: 0 }}
          />
        </div>

        {error === 'banned' && (
          <div style={{ flex: 'none', marginTop: 10 }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: color.red }}>
              <Icon name="warning" size={18} color={color.red} />
              使えない言葉が含まれています
            </p>
            <p style={{ margin: '4px 0 0 24px', fontSize: 14, fontWeight: 500, color: color.sub }}>
              お店のいいところを、1語で付けてください
            </p>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px 12px' }}>
          {typed === '' ? (
            // 何も打っていないとき：種類ごとに、よく使われるタグほど大きく
            (groups || []).map(([cat, rows]) => (
              <div key={cat} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>{cat}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {rows.map((t) => (
                    <TagChip
                      key={t.id}
                      name={t.name}
                      count={t.shop_count}
                      selected={chosen.some((c) => c.id === t.id)}
                      dim={over}
                      onClick={() => toggle(t)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ marginTop: 10 }}>
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
                  <span style={{ minWidth: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <HitName name={t.name} typed={typed} />
                  </span>
                  <span style={{ flex: 'none', fontSize: 14, fontWeight: 500, color: color.sub }}>{t.shop_count}店</span>
                </button>
              ))}

              {canMake && (
                <button
                  type="button"
                  onClick={openNew}
                  className="ui-btn"
                  style={{
                    width: '100%',
                    minHeight: 64,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    color: color.ink,
                    fontFamily: 'inherit',
                    fontSize: 16,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      border: `2px dashed ${color.ink}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="plus" size={16} strokeWidth={2.5} />
                  </span>
                  新しいタグ「#{typed}」を作る
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {askNew && (
        <NewTagSheet
          name={typed}
          busy={making}
          error={makeError}
          onMake={make}
          onCancel={() => setAskNew(false)}
        />
      )}
    </>
  );
}
