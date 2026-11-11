import { color, font } from '../theme/tokens';
import { GUIDE } from '../lib/chara';
import BottomSheet from './ui/BottomSheet';
import Button from './ui/Button';
import Icon from './ui/Icon';

// 通知の許可のお願い（画面ごとの仕様 ⑩。確定版の見本は未確認のため、既存シートの形に沿わせた暫定デザイン）
//   初めてグループに入ったとき（グループを作る・コードで参加する・招待を受け入れる）に1度だけ出す
//   「マッチしたら、すぐにお知らせします」＋キャラ（夜食カワウソ）＋サンプルの通知3つ＋［通知をオンにする］［あとで］
const SAMPLES = [
  { icon: 'heartFill', title: 'グループでマッチ', body: '「恵比寿スイーツ会」で、みんなが気になるお店が見つかりました' },
  { icon: 'personAdd', title: 'メンバーの参加', body: '@hanakoさんが「恵比寿スイーツ会」に参加しました' },
  { icon: 'mail', title: 'IDでの招待', body: '@tarouさんから、グループへの招待が届いています' },
];

export default function NotificationPermissionSheet({ open, onClose, onEnable }) {
  return (
    <BottomSheet open={open} onClose={onClose} charaCode={GUIDE.kawauso} ariaLabel="通知の許可のお願い" minHeight={430}>
      <h2 style={{ margin: '4px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.35 }}>マッチしたら、すぐにお知らせします</h2>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SAMPLES.map((s) => (
          <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: `2px solid ${color.ink}`, borderRadius: 16, background: color.white }}>
            <span style={{ display: 'flex', width: 36, height: 36, flex: 'none', borderRadius: '50%', background: color.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{s.title}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.body}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button onClick={onEnable}>通知をオンにする</Button>
        <Button variant="secondary" onClick={onClose}>
          あとで
        </Button>
      </div>
    </BottomSheet>
  );
}
