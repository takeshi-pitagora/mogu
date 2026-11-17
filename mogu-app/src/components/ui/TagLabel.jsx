import { color, font, stroke } from '../../theme/tokens';
import { TAG_FONT } from '../../lib/tags';

// ハッシュタグのラベル（確定版 Final-19・引き渡し書 第5回 §4・§6-7）
//   3種類
//     public … みんなのタグ（白に 2pt の線。＋1の数を線で区切って右。自分が＋1したらアクセント色）
//     field  … お店の情報のタグ（角の四角いクリーム）
//     notice … 知っておきたいこと（「!」の印）
//   よく使われるものほど大きく、3段階。グループの色は使わない
//
//   大きさのしきい値（§6-7）は、使う画面で変わる
//     お店のページ   ＋1が 20以上で大、10以上で中   → size={plusCount} scale="plus"
//     候補・絞り込み お店の数が 90以上で大、50以上で中 → size={shopCount} scale="shop"
//   どちらも app_settings の値なので、呼ぶ側が渡す

export default function TagLabel({
  name,
  kind = 'public',
  count = null, // みんなのタグの＋1の数
  mine = false, // 自分が＋1したか
  fontSize = TAG_FONT.small,
  onClick, // ラベル全体（タグの文字）を押したとき
  onPlus, // 右の数を押したとき（＋1）
  disabled = false,
}) {
  const label = name.startsWith('#') ? name : `#${name}`;

  // お店の情報のタグ：角の四角いクリーム。押せない
  if (kind === 'field') {
    return (
      <span
        style={{
          flex: 'none',
          height: 44,
          boxSizing: 'border-box',
          padding: '0 14px',
          border: `${stroke.shape}px solid ${color.surface}`,
          borderRadius: 10,
          background: color.surface,
          color: color.ink,
          fontSize: TAG_FONT.small,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  }

  const base = {
    flex: 'none',
    height: 44,
    boxSizing: 'border-box',
    padding: '0 14px',
    border: `${stroke.shape}px solid ${mine ? color.accent : color.ink}`,
    borderRadius: 22,
    background: mine ? color.accent : color.white,
    color: mine ? color.white : color.ink,
    fontFamily: 'inherit',
    fontSize,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };

  // 知っておきたいこと：「!」の印つき
  if (kind === 'notice') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="ui-btn" style={{ ...base, fontSize: TAG_FONT.small }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2.6" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
          <path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17v.5" />
        </svg>
        <span>{label}</span>
      </button>
    );
  }

  // みんなのタグ
  return (
    <button
      type="button"
      aria-pressed={count == null ? undefined : mine}
      onClick={onClick}
      disabled={disabled}
      className="ui-btn"
      style={base}
    >
      <span>{label}</span>
      {count != null && (
        <>
          <span aria-hidden="true" style={{ alignSelf: 'stretch', width: 2, margin: '9px 0', background: mine ? color.white : color.sub, opacity: 0.5 }} />
          <span
            onClick={
              onPlus
                ? (e) => {
                    e.stopPropagation();
                    onPlus();
                  }
                : undefined
            }
            style={{ fontFamily: font.dela, fontSize: 12, color: mine ? color.white : color.sub }}
          >
            {count}
          </span>
        </>
      )}
    </button>
  );
}

// 写真の上のタグ（確定版 Final-19-9・10）
//   カードの店名のすぐ下に、＋1の多いみんなのタグを3つまで。白い文字・数なし
export function PhotoTags({ names = [], max = 3 }) {
  if (names.length === 0) return null;
  return (
    <div aria-label="ハッシュタグ（上位3つ）" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {names.slice(0, max).map((n) => (
        <span
          key={n}
          style={{
            flex: 'none',
            height: 30,
            boxSizing: 'border-box',
            padding: '0 10px',
            border: `${stroke.shape}px solid ${color.white}`,
            borderRadius: 22,
            background: 'rgba(46,44,42,0.48)',
            color: color.white,
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {n.startsWith('#') ? n : `#${n}`}
        </span>
      ))}
    </div>
  );
}
