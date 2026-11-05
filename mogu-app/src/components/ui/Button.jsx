import { color, font, stroke } from '../../theme/tokens';
import Icon from './Icon';

// §4-1 ボタン（値は確定版 Final-15 などの見本のまま）
//   primary  主（高さ56・黒の地・白い文字16太字）… 画面に1つ
//   danger   危険（高さ56・赤の地）… 削除・ブロックなど
//   secondary 副（高さ52・白の地・2ptの線・15太字）… 主の下に10あける。押すと白黒が反転
//   small    小（高さ44・13太字）… 行の中の［更新］［解除］など
//   bar      上の帯（高さ36・黒の地・14太字）… シートや画面の右上（保存・送信・適用・完了・次へ）
//   text     文字だけ（シートの左上の［キャンセル］など）
// 押せないときは、クリームの地に灰色の文字
const base = {
  boxSizing: 'border-box',
  border: 0,
  fontFamily: font.plex,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  textAlign: 'center',
};

const variants = {
  primary: { minHeight: 56, borderRadius: 28, background: color.ink, color: color.white, fontSize: 16, padding: '0 16px' },
  danger: { minHeight: 56, borderRadius: 28, background: color.red, color: color.white, fontSize: 16, padding: '0 16px' },
  secondary: {
    minHeight: 52,
    borderRadius: 26,
    background: color.bg,
    color: color.ink,
    fontSize: 15,
    border: `${stroke.shape}px solid ${color.ink}`,
    padding: '0 16px',
  },
  small: {
    minHeight: 44,
    borderRadius: 22,
    background: color.bg,
    color: color.ink,
    fontSize: 13,
    border: `${stroke.shape}px solid ${color.ink}`,
    padding: '0 14px',
  },
  bar: { minHeight: 36, borderRadius: 18, background: color.ink, color: color.white, fontSize: 14, padding: '0 18px', margin: '4px 0' },
  text: { minHeight: 44, background: 'transparent', color: color.ink, fontSize: 15, fontWeight: 500, padding: '0 8px' },
};

const disabledStyle = { background: color.surface, color: color.sub, border: 0 };

export default function Button({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  full,
  icon,
  type = 'button',
  style,
  ariaLabel,
}) {
  const v = variants[variant] || variants.primary;
  const isFull = full ?? ['primary', 'danger', 'secondary'].includes(variant);
  const s = {
    ...base,
    ...v,
    ...(disabled && variant !== 'text' ? disabledStyle : null),
    ...(disabled && variant === 'text' ? { color: color.sub } : null),
    width: isFull ? '100%' : undefined,
    flex: isFull ? undefined : 'none',
    ...style,
  };
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={s}
    >
      {icon && <Icon name={icon} size={20} color="currentColor" />}
      {children}
    </button>
  );
}
