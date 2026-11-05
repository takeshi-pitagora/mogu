import { useState, useId } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import Icon from './Icon';

// §4-2 入力欄（見た目は確定版 Final-07・Final-15 の見本のまま：高さ56・角丸18・2ptの線・文字16）
// 入力中は線が 3pt。エラーは欄の下に赤い文字。上限がある欄は右下に「今／上限」（上限で赤）
// パスワードの欄には「見せる・隠す」の切り替え
export default function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  maxLength,
  showCount = false,
  autoComplete,
  inputMode,
  multiline = false,
  rows = 4,
  disabled = false,
  prefix,
  style,
}) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const len = String(value ?? '').length;
  const atLimit = maxLength != null && len >= maxLength;

  const box = {
    display: 'flex',
    alignItems: multiline ? 'flex-start' : 'center',
    gap: 4,
    minHeight: 56,
    boxSizing: 'border-box',
    // エラーのときは線が赤の 3pt（そのぶん内側の余白を 1 減らす。確定版 Final-07 の見本どおり）
    padding: isPassword ? `0 10px 0 ${error ? 17 : 18}px` : multiline ? '14px 18px' : `0 ${error ? 17 : 18}px`,
    border: `${error ? stroke.focus : stroke.shape}px solid ${error ? color.red : color.ink}`,
    borderRadius: 18,
    background: disabled ? color.surface : color.bg,
    fontFamily: font.plex,
    fontSize: 16,
    color: disabled ? color.sub : color.ink,
  };

  return (
    <div style={style}>
      {label && (
        <label htmlFor={id} style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700, color: error ? color.red : color.ink }}>
          {label}
        </label>
      )}
      <div className={`ui-field${error ? ' ui-field--error' : ''}`} style={box}>
        {prefix && <span style={{ flex: 'none', color: color.sub }}>{prefix}</span>}
        {multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={rows}
            disabled={disabled}
            style={{ resize: 'none', lineHeight: 1.6 }}
          />
        ) : (
          <input
            id={id}
            type={isPassword && !reveal ? 'password' : isPassword ? 'text' : type}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete={autoComplete}
            inputMode={inputMode}
            disabled={disabled}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ height: 52 }}
          />
        )}
        {error && !isPassword && !multiline && <Icon name="warning" size={20} color={color.red} />}
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'パスワードを隠す' : 'パスワードを見せる'}
            style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
          >
            <Icon name={reveal ? 'eye' : 'eyeOff'} size={22} />
          </button>
        )}
      </div>
      {(error || (showCount && maxLength != null)) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
          <span role={error ? 'alert' : undefined} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: color.red }}>
            {error}
          </span>
          {showCount && maxLength != null && (
            <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: atLimit ? color.red : color.sub }}>
              {len}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
