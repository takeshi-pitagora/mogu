import { color } from '../../theme/tokens';
import { GUIDE } from '../../lib/chara';
import BottomSheet, { SheetTitle } from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';

// 通知の許可のお願い（引き渡し書 §7-6）：グループを初めて使うとき、1度だけ出す
//   ［許可する］→ 端末の通知の許可を求める／［あとで］→ 何もせず閉じる（どちらも二度と出さない）
export default function PushPermissionSheet({ onAllow, onSkip }) {
  return (
    <BottomSheet open onClose={onSkip} charaCode={GUIDE.harry} ariaLabel="通知を受け取りますか？" minHeight={250}>
      <SheetTitle>通知を受け取りますか？</SheetTitle>
      <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, color: color.ink, textAlign: 'left' }}>
        マッチしたときや、グループに新しいメンバーが参加したときに知らせます。設定からいつでも変更できます。
      </p>
      <div style={{ flex: 1, minHeight: 0 }} />
      <Button variant="primary" onClick={onAllow} style={{ marginTop: 18 }}>
        許可する
      </Button>
      <Button variant="secondary" onClick={onSkip} style={{ marginTop: 10 }}>
        あとで
      </Button>
    </BottomSheet>
  );
}
