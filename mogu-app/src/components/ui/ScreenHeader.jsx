import { color, font, stroke } from '../../theme/tokens';
import Icon from './Icon';

// §4-11 画面の上部（確定版 Final-15 の見本のまま。見本の上の54は iPhone の時計の帯 → safe-area に置き換え）
//   見出しの画面（グループ・保存など）：左に見出し（Dela 30）、右にアイコン（丸い枠なし24・押せる範囲44×44）、下を2ptの線で締める
//   中の画面（設定など）：左上に戻る、まん中に見出し（Dela 16）
export function TitleHeader({ title, actions = [], bordered = true }) {
  return (
    <header
      style={{
        flex: 'none',
        boxSizing: 'border-box',
        paddingTop: 'var(--safe-top)',
        background: color.bg,
        borderBottom: bordered ? `${stroke.shape}px solid ${color.ink}` : 0,
      }}
    >
      <div style={{ height: 56, boxSizing: 'border-box', padding: '0 8px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontFamily: font.dela, fontSize: 30, fontWeight: 400, lineHeight: 1, color: color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {actions.map((a) => (
            <HeaderIconButton key={a.label} {...a} />
          ))}
        </div>
      </div>
    </header>
  );
}

export function BackHeader({ title, onBack, right }) {
  return (
    <header style={{ flex: 'none', paddingTop: 'var(--safe-top)', background: color.bg }}>
      <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: font.dela, fontSize: 16, whiteSpace: 'nowrap', color: color.ink }}>{title}</span>
        {right || <span style={{ width: 44 }} />}
      </div>
    </header>
  );
}

// 上部のアイコン：丸い枠なしで24だけ見せ、押せる範囲は見えない44×44。読み上げ用の名前を付ける
export function HeaderIconButton({ icon, label, onClick, badge, dot, children }) {
  return (
    <button
      type="button"
      className="ui-btn ui-btn--text"
      onClick={onClick}
      aria-label={label}
      style={{ position: 'relative', width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
    >
      {children || <Icon name={icon} size={24} />}
      {dot && (
        // 未読は赤い点（直径10・白いふち2）だけで、数字は出さない
        <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%', background: color.red, boxShadow: `0 0 0 2px ${color.white}` }} />
      )}
      {badge != null && badge > 0 && (
        // 絞り込み：選んでいる項目の数を黒い丸で
        <span aria-hidden="true" style={{ position: 'absolute', top: -1, right: -4, minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box', borderRadius: 9, background: color.ink, color: color.white, boxShadow: `0 0 0 2px ${color.white}`, fontFamily: font.plex, fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}>
          {badge}
        </span>
      )}
    </button>
  );
}
