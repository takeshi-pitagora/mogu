import { color, stroke } from '../../theme/tokens';

// 選ぶチップ（確定版 Final-18・Final-08 の見本のまま）
//   高さ44・角丸22・2ptの線。選んでいないとき白、選んだら黒に白い文字
//   これ以上選べないときは、ふちも地もクリーム（押せない）
//   note は選んだチップの中に小さく出す文字（「メイン」「サブ」）
export default function ChoiceChip({ children, selected = false, disabled = false, note, onClick, ariaLabel }) {
  const off = {
    border: `${stroke.shape}px solid ${color.ink}`,
    background: color.white,
    color: color.ink,
    fontWeight: 500,
  };
  const on = {
    border: `${stroke.shape}px solid ${color.ink}`,
    background: color.ink,
    color: color.white,
    fontWeight: 700,
  };
  const dim = {
    border: `${stroke.shape}px solid ${color.surface}`,
    background: color.surface,
    color: color.sub,
    fontWeight: 500,
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled && !selected}
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        height: 44,
        boxSizing: 'border-box',
        padding: '0 14px',
        borderRadius: 22,
        fontFamily: 'inherit',
        fontSize: 14,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        ...(selected ? on : disabled ? dim : off),
      }}
    >
      {children}
      {selected && note && <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{note}</span>}
    </button>
  );
}

// チップを並べる所
export function ChipRow({ children, style }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>{children}</div>;
}

// 左に小さな見出しを置いてチップを並べる行（「行った日」「時間」「あなたは」）
export function ChipField({ label, children, style }) {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <span style={{ flex: 'none', width: 56, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChipRow>{children}</ChipRow>
      </div>
    </div>
  );
}
