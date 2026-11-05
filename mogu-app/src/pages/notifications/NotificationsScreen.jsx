import { color, font } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';

// お知らせ（確定版 Final-10）。1回目は通知の仕組みがまだないので、0件の画面だけ（引き渡し書 §2・実装計画 6章 #7）
//   上部：左上に戻る、まん中に「お知らせ」（Dela 16）
//   0件：ベルのクリームの丸（96）と「お知らせはまだありません」（Dela 20）
export default function NotificationsScreen({ onBack }) {
  return (
    <div style={{ position: 'relative', height: '100%', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <header style={{ paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>お知らせ</h1>
          <span style={{ width: 44 }} />
        </div>
      </header>
      <div role="status" style={{ position: 'absolute', left: 32, right: 32, top: 'calc(var(--safe-top) + 304px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <span style={{ width: 96, height: 96, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={44} />
        </span>
        <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 20 }}>お知らせはまだありません</p>
      </div>
    </div>
  );
}
