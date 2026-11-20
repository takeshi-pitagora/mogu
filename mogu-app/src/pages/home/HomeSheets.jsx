import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { Radio, GroupRadioRow } from '../../components/ui/Radio';
import { groupRowStyle as rowStyle } from '../../components/ui/styles';
import { AREAS, BUDGETS, GENRES, EMPTY_FILTERS, SORTS } from '../../lib/shop';
import { useAuth } from '../../context/AuthContext';
import { SCENES, sceneOf } from '../../lib/scenes';
import { chara } from '../../lib/chara';
import { groupColor, groupOf } from '../../theme/tokens';
import { popularTags } from '../../lib/shops';

// ---------------------------------------------------------------
// 絞り込みのシート（確定版 Final-08 の 5・6）
//   左上に［キャンセル］、見出し「絞り込み」、右上に［適用］、いちばん下に［すべてクリア］
//   並び順（1つ）・エリア（複数）・ジャンル（複数）・予算（1つ）
//   1回目の並び順は「おすすめ」だけ（ほかは3回目まで出さない）。年代別の評価順は Coming Soon（押せない）
// ---------------------------------------------------------------

function FilterChip({ selected, children, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="ui-btn"
      style={{
        height: 44,
        boxSizing: 'border-box',
        padding: '0 18px',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 22,
        background: selected ? color.ink : color.white,
        color: selected ? color.white : color.ink,
        fontFamily: font.plex,
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function ComingSoonChip({ children }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      style={{ height: 44, boxSizing: 'border-box', padding: '0 8px 0 16px', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: 22, background: color.white, color: color.sub, fontFamily: font.plex, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      {children}
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Coming Soon</span>
    </button>
  );
}

function NeedsDiagnosisChip({ children }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      style={{ height: 44, boxSizing: 'border-box', padding: '0 8px 0 16px', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: 22, background: color.white, color: color.sub, fontFamily: font.plex, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      {children}
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.surface, color: color.sub, fontFamily: font.plex, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>診断すると選べます</span>
    </button>
  );
}

function Group({ title, note, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: color.sub }}>{note}</span>
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

// ㉔-2 シーンのタイル（2列・高さ132・角丸22）
function SceneTile({ scene, selected, onClick }) {
  const c = chara(scene.chara);
  const pale = groupColor[groupOf(scene.chara)]?.light || color.surface;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="ui-btn"
      style={{
        position: 'relative',
        height: 132,
        boxSizing: 'border-box',
        padding: '12px 14px',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 22,
        background: selected ? color.ink : color.white,
        color: selected ? color.white : color.ink,
        fontFamily: font.plex,
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, display: 'block', fontFamily: font.dela, fontSize: 17, fontWeight: 400 }}>
        {scene.label}
      </span>
      <span style={{ position: 'relative', zIndex: 1, display: 'block', marginTop: 6, width: '62%', fontSize: 11, fontWeight: 500, lineHeight: 1.5, color: selected ? color.white : color.sub }}>
        {scene.tags.map((t) => `#${t}`).join('・')}
      </span>
      {/* 右下にシーンに合うモグキャラ（高さ104・足もとはタイルの下のふち、うしろに淡い色の丸） */}
      <span aria-hidden="true" style={{ position: 'absolute', right: 2, bottom: 0, width: 108, height: 104 }}>
        <span style={{ position: 'absolute', right: 10, bottom: 6, width: 86, height: 86, borderRadius: 43, background: pale }} />
        <img src={c?.framed} alt="" style={{ position: 'absolute', right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
      </span>
    </button>
  );
}

export function FilterSheet({ open, value, count, onCount, onApply, onClose }) {
  const { user } = useAuth();
  const diagnosed = !!user?.moguType?.code;
  const [draft, setDraft] = useState(value);
  // シーンを選んでいなければ、まず「今日はどんな日？」から（㉔-2）
  const [step, setStep] = useState(value.scene || value.tags?.length > 0 ? 'detail' : 'scene');
  const [q, setQ] = useState('');
  const [popular, setPopular] = useState([]);
  const toggle = (key, v) => setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    popularTags(8).then((rows) => alive && setPopular(rows)).catch(() => {});
    return () => { alive = false; };
  }, [open]);

  useEffect(() => { onCount?.(draft); }, [draft, onCount]);

  const scene = sceneOf(draft.scene);
  const sceneChara = scene ? chara(scene.chara) : null;

  const pickScene = (sc) => setDraft((d) => ({
    ...d,
    scene: sc.key,
    tags: [...new Set([...(d.tags || []), ...sc.tags])],
  }));

  const footer = (
    <div style={{ flex: 'none', display: 'flex', gap: 12, padding: '12px 20px 34px', borderTop: `1px solid ${color.line}` }}>
      <button
        type="button"
        onClick={() => setDraft({ ...EMPTY_FILTERS })}
        className="ui-btn"
        style={{ flex: 1, height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.lineStrong}`, borderRadius: 28, background: color.white, color: color.sub, fontFamily: font.plex, fontSize: 16, fontWeight: 700 }}
      >
        すべてクリア
      </button>
      <button
        type="button"
        onClick={() => onApply(draft)}
        className="ui-btn"
        style={{ flex: 1.3, height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 16, fontWeight: 700 }}
      >
        <span style={{ fontFamily: font.dela, fontSize: 18 }}>{count == null ? '' : count.toLocaleString()}</span>
        店を見る
      </button>
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} height="calc(100% - var(--safe-top) - 38px)" maxHeight="none" padding="10px 0 0" ariaLabel="絞り込み">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 12px', flex: 'none' }}>
        <Button variant="text" onClick={onClose}>キャンセル</Button>
        <h2 style={{ margin: 0, textAlign: 'center', fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>
          絞り込み
          {step === 'detail' && (
            <span style={{ display: 'block', marginTop: 2, fontFamily: font.plex, fontSize: 13, fontWeight: 500, color: color.sub }}>細かい条件</span>
          )}
        </h2>
        <button type="button" className="ui-btn ui-btn--bar" onClick={() => onApply(draft)} style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 15, fontWeight: 700 }}>
          適用
        </button>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {step === 'scene' ? (
          <div style={{ padding: '8px 20px 16px' }}>
            <h3 style={{ margin: '4px 0 16px', fontFamily: font.dela, fontSize: 26, fontWeight: 400 }}>今日はどんな日？</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {SCENES.map((sc) => (
                <SceneTile
                  key={sc.key}
                  scene={sc}
                  selected={draft.scene === sc.key}
                  onClick={() => { pickScene(sc); setStep('detail'); }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep('detail')}
              className="ui-btn"
              style={{ width: '100%', minHeight: 60, marginTop: 22, border: 0, background: 'transparent', color: color.ink, fontFamily: font.plex, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              シーンを決めずに細かく決める
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 20px 16px' }}>
            {/* いちばん上に黒い帯でキャラとシーンの名前と［変える］（㉔-4） */}
            {scene && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 76, padding: '0 10px 0 12px', borderRadius: 24, background: color.ink }}>
                <span aria-hidden="true" style={{ flex: 'none', width: 56, height: 56, borderRadius: 28, background: color.white, overflow: 'hidden' }}>
                  <img src={sceneChara?.framed} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: font.dela, fontSize: 20, color: color.white }}>{scene.label}</span>
                <button
                  type="button"
                  onClick={() => setStep('scene')}
                  className="ui-btn"
                  style={{ flex: 'none', height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.white, color: color.ink, fontFamily: font.plex, fontSize: 15, fontWeight: 700 }}
                >
                  変える
                </button>
              </div>
            )}

            <Group title="ハッシュタグ" note="選んだタグをすべて持つお店">
              {(draft.tags || []).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle('tags', t)}
                  className="ui-btn"
                  aria-label={`#${t} を外す`}
                  style={{ height: 44, boxSizing: 'border-box', padding: '0 16px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}
                >
                  #{t}
                  <Icon name="close" size={14} color={color.white} strokeWidth={2.5} />
                </button>
              ))}
            </Group>

            <div
              onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
              style={{ minHeight: 56, boxSizing: 'border-box', padding: '4px 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 10, marginTop: -8 }}
            >
              <span aria-hidden="true" style={{ fontFamily: font.dela, fontSize: 17, color: color.sub }}>#</span>
              <input
                aria-label="タグで探す"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && q.trim()) { toggle('tags', q.trim().replace(/^#/, '')); setQ(''); }
                }}
                placeholder="#タグで探す"
                style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, color: color.ink, padding: 0 }}
              />
            </div>

            <div style={{ marginTop: -8 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 500, color: color.sub }}>人気のタグ</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {popular.filter((t) => !(draft.tags || []).includes(t.name)).map((t) => (
                  <FilterChip key={t.id} selected={false} onClick={() => toggle('tags', t.name)}>#{t.name}</FilterChip>
                ))}
              </div>
            </div>

            <Group title="エリア" note="東京のどこでも・複数選択可">
              {AREAS.map((a) => (
                <FilterChip key={a} selected={draft.areas.includes(a)} onClick={() => toggle('areas', a)}>{a}</FilterChip>
              ))}
            </Group>
            <Group title="ジャンル" note="複数選択可">
              {GENRES.map((g) => (
                <FilterChip key={g} selected={draft.genres.includes(g)} onClick={() => toggle('genres', g)}>{g}</FilterChip>
              ))}
            </Group>
            <Group title="予算" note="1つ選ぶ">
              {BUDGETS.map((b) => (
                <FilterChip key={b.value} selected={draft.priceLevel === b.value} onClick={() => setDraft((d) => ({ ...d, priceLevel: d.priceLevel === b.value ? null : b.value }))}>
                  {b.label}
                </FilterChip>
              ))}
            </Group>
            <Group title="並び順" note="1つ選ぶ">
              {SORTS.map((sx) => {
                if (sx.value === 'mogu_type_popular' && !diagnosed) {
                  return <NeedsDiagnosisChip key={sx.value}>{sx.label}</NeedsDiagnosisChip>;
                }
                return (
                  <FilterChip key={sx.value} selected={draft.sort === sx.value} onClick={() => setDraft((d) => ({ ...d, sort: sx.value }))}>
                    {sx.label}
                  </FilterChip>
                );
              })}
              <ComingSoonChip>年代別の評価順</ComingSoonChip>
            </Group>
          </div>
        )}
      </div>
      {footer}
    </BottomSheet>
  );
}

// ---------------------------------------------------------------
// 探し方のシート（確定版 Final-08 の 4）：［ひとりで探す］と、参加中のグループ
// ゲストのときは見本のグループ「mogu部」（見本の印・うすく表示・押しても開かない）と［アカウントを登録する］（Final-14）
// ---------------------------------------------------------------
export function SearchModeSheet({ open, groups = [], selectedGroupId, onSelect, onClose, guestSlot }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="探し方">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, marginTop: 6 }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>探し方</h2>
        <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, marginRight: -10, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={22} />
        </button>
      </div>
      <div role="radiogroup" aria-label="探し方" style={{ marginTop: 6, overflowY: 'auto' }}>
        <button type="button" role="radio" aria-checked={!selectedGroupId} onClick={() => onSelect(null)} style={rowStyle}>
          <span style={{ flex: 'none', width: 104, display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 38, height: 38, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="personGuest" size={20} />
            </span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>ひとりで探す</span>
          </span>
          <Radio on={!selectedGroupId} />
        </button>
        {groups.map((g) => (
          <GroupRadioRow key={g.id} group={g} on={selectedGroupId === g.id} onClick={() => onSelect(g)} />
        ))}
        {guestSlot}
      </div>
    </BottomSheet>
  );
}
