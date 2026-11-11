import { useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { Radio, GroupRadioRow } from '../../components/ui/Radio';
import { groupRowStyle as rowStyle } from '../../components/ui/styles';
import { AREAS, BUDGETS, GENRES, EMPTY_FILTERS } from '../../lib/shop';

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

export function FilterSheet({ open, value, onApply, onClose, showTypePopular }) {
  const [draft, setDraft] = useState(value);
  const toggle = (key, v) => setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));

  return (
    <BottomSheet open={open} onClose={onClose} height="calc(100% - var(--safe-top) - 38px)" maxHeight="none" padding="10px 0 0" ariaLabel="絞り込み">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 12px', flex: 'none' }}>
        <Button variant="text" onClick={onClose}>キャンセル</Button>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>絞り込み</h2>
        <button type="button" className="ui-btn ui-btn--bar" onClick={() => onApply(draft)} style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 15, fontWeight: 700 }}>
          適用
        </button>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 20px 16px' }}>
          <Group title="並び順" note="1つ選ぶ">
            <FilterChip selected={draft.sort === 'recommend'} onClick={() => setDraft((d) => ({ ...d, sort: 'recommend' }))}>おすすめ</FilterChip>
            {showTypePopular && (
              <FilterChip selected={draft.sort === 'typePopular'} onClick={() => setDraft((d) => ({ ...d, sort: 'typePopular' }))}>同じモグタイプに人気</FilterChip>
            )}
            <FilterChip selected={draft.sort === 'trending'} onClick={() => setDraft((d) => ({ ...d, sort: 'trending' }))}>急上昇中</FilterChip>
            <ComingSoonChip>年代別の評価順</ComingSoonChip>
          </Group>
          <Group title="エリア" note="複数選択可">
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
        </div>
      </div>
      <div style={{ flex: 'none', padding: '12px 20px 34px', borderTop: `1px solid ${color.line}` }}>
        <Button variant="secondary" onClick={() => setDraft({ ...EMPTY_FILTERS })}>すべてクリア</Button>
      </div>
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
