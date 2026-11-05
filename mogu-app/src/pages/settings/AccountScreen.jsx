import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/ui/Avatar';
import ConfirmSheet from '../../components/ui/ConfirmSheet';
import { Row, RowGroup, SubPage } from './SettingsParts';

// アカウント（確定版 Final-05 の 6・8）
//   上に写真の丸（72）とニックネーム、メールアドレス（表示だけ）、パスワードの変更。いちばん下に赤い下線の「アカウントを削除」
//   ユーザーIDの行は2回目（1回目は出さない）
//   削除の確認：「削除」と入れてから押せる（§4-4）
export default function AccountScreen({ onBack, onOpenPassword }) {
  const { user, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;

  const doDelete = async () => {
    setBusy(true);
    setError('');
    const { error: e } = await deleteAccount();
    setBusy(false);
    if (e) setError(e);
  };

  return (
    <SubPage title="アカウント" onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0 20px' }}>
        <Avatar size={72} name={user.name} />
        <span style={{ fontFamily: font.dela, fontSize: 18 }}>{user.name}</span>
      </div>
      <RowGroup>
        <Row first height={56} label="メールアドレス" value={user.email || ''} />
        <Row height={56} label="パスワードの変更" onClick={onOpenPassword} />
      </RowGroup>
      <button
        type="button"
        onClick={() => {
          setError('');
          setConfirm(true);
        }}
        className="ui-btn ui-btn--text"
        style={{ display: 'block', height: 44, margin: '40px auto 0', padding: '0 12px', border: 0, background: 'transparent', color: color.red, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        アカウントを削除
      </button>
      <ConfirmSheet
        open={confirm}
        title="アカウントを削除しますか？"
        description="この操作は取り消せません。次のものがすべて消えます。"
        items={['プロフィール', 'スワイプの履歴', '保存したお店', '作ったグループ']}
        note="あなたが作ったグループは、ほかのメンバーがいれば、いちばん早く入った人に引き継がれます。メンバーがいなければ消えます。"
        confirmWord="削除"
        danger
        busy={busy}
        error={error}
        actionLabel="アカウントを削除する"
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </SubPage>
  );
}
