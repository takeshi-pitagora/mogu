import { color, stroke } from '../../theme/tokens';

// スイッチ（オン・オフ）。確定版のHTMLからこの部品だけを単独で再抽出できなかったため、
// 他の部品（ScopeCardの丸チェック・ボタンの角丸）と同じ線幅・色で、iOSの標準的なスイッチの
// 形に合わせて作った暫定の見た目。実物のFinal-05と見比べて違いがあれば直す
export default function Switch({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!on)}
      className="ui-btn"
      style={{
        position: 'relative',
        flex: 'none',
        width: 50,
        height: 30,
        padding: 2,
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 15,
        background: on ? color.ink : color.white,
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: on ? color.white : color.ink,
          transition: 'transform 0.15s ease',
        }}
      />
    </button>
  );
}
