import { color, stroke } from '../../theme/tokens';

// ⑯ 下のタブのまん中のステッカーの＋（確定版 Final-16・引き渡し書 第5回 §4）
//   クリームの角丸の四角（42・角丸13）に 2pt の黒い線と黒い＋（線 2.75）、−8度傾ける
//   押せる範囲は 幅52×高さ56。押したとき #E2DCD2。選んだ状態にはならない
const PRESSED_BG = '#E2DCD2';

export default function PlusSticker({ onClick, pressed = false, style }) {
  return (
    <button
      type="button"
      aria-label="お店を登録"
      onClick={onClick}
      className="ui-btn"
      style={{
        position: 'relative',
        flex: 'none',
        width: 52,
        height: 56,
        border: 0,
        padding: 0,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          boxSizing: 'border-box',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderRadius: 13,
          background: pressed ? PRESSED_BG : color.surface,
          transform: 'rotate(-8deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </button>
  );
}
