import { color, font, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';

// =============================================================
// ㉕-1〜4 検索欄のすぐ下の段（確定版 Final-25 の 1〜4・9・11・13）
//   いちばん左から［駅 ▼］→ 仕切りの線 →［あなたが見つけた N］→
//   保存したお店のタグ（多い順・右に数）。見た目36・押せる範囲44・横にすべらせる。
//   押すと黒くなって前に来る（×で外す）。数は今の絞り込みの中の数で、0になったものは消える。
// =============================================================

function Pill({ selected, onClick, label, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className="ui-btn"
      style={{ flex: 'none', height: 44, padding: '4px 0', border: 0, background: 'transparent', fontFamily: font.plex }}
    >
      <span
        style={{
          height: 36,
          boxSizing: 'border-box',
          padding: '0 12px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderRadius: 18,
          background: selected ? color.ink : color.white,
          color: selected ? color.white : color.ink,
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {children}
      </span>
    </button>
  );
}

// 外すしるしの×（確定版 13・線2.75）
function Cross() {
  return <Icon name="close" size={13} color={color.white} strokeWidth={2.75} />;
}

// 数（確定版 11・700・補足の色）
function Count({ n }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: color.sub }}>{n}</span>;
}

export default function SavedFilterStrip({
  station, nearby, mine, tags, selectedTags, onOpenStation, onClearStation, onToggleMine, onToggleTag,
}) {
  // 選んだタグは前に来る
  const order = [
    ...tags.filter((t) => selectedTags.includes(t.name)),
    ...tags.filter((t) => !selectedTags.includes(t.name)),
  ];
  const stationLabel = station ? `${station}駅${nearby ? '＋近く' : ''}` : '駅';

  return (
    <div style={{ flex: 'none', marginTop: 8, height: 44, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 6, padding: '0 20px' }}>
        <Pill
          selected={!!station}
          onClick={station ? onClearStation : onOpenStation}
          label={station ? `${stationLabel}の絞り込みを外す` : '駅で絞る'}
        >
          <Icon name="train" size={15} color={station ? color.white : color.ink} strokeWidth={2.2} />
          {stationLabel}
          {station ? <Cross /> : <Icon name="chevronDown" size={14} strokeWidth={2.6} />}
        </Pill>

        <span aria-hidden="true" style={{ flex: 'none', alignSelf: 'center', width: 2, height: 24, margin: '0 2px', background: color.lineStrong }} />

        {(mine.n > 0 || mine.on) && (
          <Pill selected={mine.on} onClick={onToggleMine} label="あなたが見つけたお店だけ">
            <Icon name="dig" size={15} color={mine.on ? color.white : color.ink} />
            あなたが見つけた
            {mine.on ? <Cross /> : <Count n={mine.n} />}
          </Pill>
        )}

        {order.map((t) => {
          const on = selectedTags.includes(t.name);
          return (
            <Pill key={t.name} selected={on} onClick={() => onToggleTag(t.name)} label={`#${t.name} で絞る`}>
              #{t.name}
              {on ? <Cross /> : <Count n={t.n} />}
            </Pill>
          );
        })}
      </div>
    </div>
  );
}
