import { useState } from 'react';
import { color } from '../../theme/tokens';
import { GUIDE } from '../../lib/chara';
import BottomSheet, { SheetTitle } from './BottomSheet';
import Button from './Button';
import TextField from './TextField';
import Icon from './Icon';

// §4-4 確認の画面（確定版 Final-15 の「ログアウトしますか？」「アカウントを削除しますか？」の見本のまま）
//   形は下から出るシート。右上のふちに探偵ハリー
//   並び：見出し「〜しますか？」→ 説明 → 操作のボタン →［キャンセル］
//   説明は取り消せない操作のときだけ。消える・離れる・切れる操作は赤（danger）
//   confirmWord を渡すと「確認のため「削除」と入力してください」の欄が出て、入れるまで押せない
export default function ConfirmSheet({
  open,
  title,
  description,
  items,
  note,
  actionLabel,
  danger = false,
  confirmWord,
  busy = false,
  error,
  onConfirm,
  onCancel,
  cancelLabel = 'キャンセル',
  height,
}) {
  const [typed, setTyped] = useState('');
  const canConfirm = !busy && (!confirmWord || typed === confirmWord);

  const close = () => {
    setTyped('');
    onCancel?.();
  };

  return (
    <BottomSheet open={open} onClose={close} charaCode={GUIDE.harry} ariaLabel={title} height={height} minHeight={250}>
      <SheetTitle>{title}</SheetTitle>
      {description && <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, color: color.ink, textAlign: 'left' }}>{description}</p>}
      {items?.length > 0 && (
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: 14, fontWeight: 700 }}>
          {items.map((it) => (
            <li key={it} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28 }}>
              <Icon name="trash" size={16} strokeWidth={2.5} color={color.sub} />
              {it}
            </li>
          ))}
        </ul>
      )}
      {note && <p style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 18, background: color.surface, fontSize: 12, lineHeight: 1.6 }}>{note}</p>}
      {confirmWord && (
        <div style={{ marginTop: 14 }}>
          <TextField label={`確認のため「${confirmWord}」と入力してください`} value={typed} onChange={setTyped} placeholder={confirmWord} />
        </div>
      )}
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: color.red }}>{error}</p>}
      <div style={{ flex: 1, minHeight: 0 }} />
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={!canConfirm} style={{ marginTop: 18 }}>
        {actionLabel}
      </Button>
      <Button variant="secondary" onClick={close} style={{ marginTop: 10 }}>
        {cancelLabel}
      </Button>
    </BottomSheet>
  );
}
