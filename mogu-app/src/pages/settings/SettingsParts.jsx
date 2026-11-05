import { color, font, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';

// 設定とその中の画面の部品（確定版 Final-05 ひと目型のまま）

// 中の画面の上部：左上に戻る、まん中に見出し（Dela 16）
export function SubHeader({ title, onBack }) {
  return (
    <header style={{ flex: 'none', paddingTop: 'var(--safe-top)', background: color.bg }}>
      <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
        <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>{title}</h1>
        <span style={{ width: 44 }} />
      </div>
    </header>
  );
}

// スクロールする中身（上16・左右20・下130：浮いたタブに隠れない）
export function SubBody({ children }) {
  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ padding: '16px 20px 130px' }}>{children}</div>
    </div>
  );
}

export function SubPage({ title, onBack, children }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <SubHeader title={title} onBack={onBack} />
      <SubBody>{children}</SubBody>
    </div>
  );
}

// まとまりの見出し（Dela 18・高さ30）
export function GroupTitle({ children }) {
  return <h2 style={{ margin: '24px 0 0', height: 30, fontFamily: font.dela, fontSize: 18, fontWeight: 400, lineHeight: '24px' }}>{children}</h2>;
}

// 行のまとまり（上下を2ptの線で締める）
export function RowGroup({ children, style }) {
  return <div style={{ borderTop: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}`, ...style }}>{children}</div>;
}

// 行（高さ52・文字15/500）。右は「>」か外部ページの印。value は右に補足（13・sub）
export function Row({ label, onClick, external = false, first = false, value, height = 52, chevron = true }) {
  const inner = (
    <>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {value != null && <span style={{ fontSize: 13, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{value}</span>}
      {onClick && external && (
        <span style={{ color: color.sub, display: 'flex' }}>
          <Icon name="external" size={16} label="外のページを開きます" />
        </span>
      )}
      {onClick && !external && chevron && <Icon name="chevronRight" size={16} />}
    </>
  );
  const style = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, height, padding: 0, border: 0, borderTop: first ? 0 : `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' };
  if (!onClick) return <div style={style}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} className="ui-btn ui-btn--text" style={style}>
      {inner}
    </button>
  );
}

// タイル（アイコン・項目名・今の状態 Dela 20）
export function Tile({ icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-btn--tile"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 112, boxSizing: 'border-box', padding: '14px 16px', border: 0, borderRadius: 24, background: color.surface, color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon name={icon} size={22} />
        <Icon name="chevronRight" size={16} />
      </span>
      <span style={{ display: 'block', marginTop: 8, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ display: 'block', marginTop: 8, fontFamily: font.dela, fontSize: 20, lineHeight: 1.2 }}>{value}</span>
    </button>
  );
}
