import { useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import ConfirmSheet from '../../components/ui/ConfirmSheet';
import DiagnosisModal from '../../components/DiagnosisModal';
import { getType } from '../../lib/mogutype';
import { HELP_URL, OPERATOR_URL, PRIVACY_POLICY_URL, SHOP_INFO_URL, SUPPORT_EMAIL, TERMS_URL } from '../../lib/links';
import { openExternal } from '../../lib/open';
import { APP_VERSION } from '../../lib/version';
import { GroupTitle, Row, RowGroup, SubPage, Tile } from './SettingsParts';

// 設定（確定版 Final-05 ひと目型）。プロフィール右上の歯車から開く
//   いちばん上のカード（写真・ニックネーム・メールアドレス → アカウント）、タイル、サポート、このアプリについて、［ログアウト］、バージョン
//   1回目：タイルは「食スタイル診断」だけ（今の20問の診断を開く）。通知・招待を受け取る範囲は3回目・2回目、ブロックしたユーザーと
//   「通報したい内容がある」は2回目まで出さない。押しても何も起きない行は置かない
//   ゲストのとき：いちばん上のカードの代わりに［アカウントを登録する］（Final-05 の 4）。ログアウトは出さない
function AccountCard({ user, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-press"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: color.white, color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
    >
      <Avatar size={56} name={user.name} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: font.dela, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
        {user.email && <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 700 }}>
        アカウント
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  );
}

function RegisterCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-btn--primary"
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '18px 18px 18px 20px', boxSizing: 'border-box', border: 0, borderRadius: 24, background: color.ink, color: color.white, fontFamily: 'inherit', textAlign: 'left' }}
    >
      <Icon name="personAdd" size={26} color={color.white} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: font.dela, fontSize: 17 }}>アカウントを登録する</span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.6, color: color.line }}>登録すると、グループやIDでの招待が使えます。ゲストで保存したお店はそのまま残ります。</span>
      </span>
      <Icon name="chevronRight" size={18} color={color.white} />
    </button>
  );
}

export default function SettingsScreen({ onBack, onOpenAccount, onShowGuide, onRegister }) {
  const { user, logout } = useAuth();
  const guest = !!user?.isGuest;
  const [confirm, setConfirm] = useState(false);
  const [diagnosis, setDiagnosis] = useState(false);
  if (!user) return null;
  const diagnosed = !!getType(user.foodStyle);

  const about = [
    { label: '利用規約', url: TERMS_URL, external: true },
    { label: 'プライバシーポリシー', url: PRIVACY_POLICY_URL, external: true },
    SHOP_INFO_URL && { label: 'お店の情報について', url: SHOP_INFO_URL },
    OPERATOR_URL && { label: '運営者', url: OPERATOR_URL },
  ].filter(Boolean);

  return (
    <SubPage title="設定" onBack={onBack}>
      {guest ? <RegisterCard onClick={onRegister} /> : <AccountCard user={user} onClick={onOpenAccount} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        <Tile icon="link" label="食スタイル診断" value={diagnosed ? '診断済み' : '未診断'} onClick={() => setDiagnosis(true)} />
      </div>

      <GroupTitle>サポート</GroupTitle>
      <RowGroup>
        <Row first label="ヘルプ（よくある質問）" external onClick={() => openExternal(HELP_URL)} />
        <Row label="使い方をもう一度見る" onClick={onShowGuide} />
        <Row label="お問い合わせ・不具合の報告" onClick={() => window.open(`mailto:${SUPPORT_EMAIL}`, '_self')} />
      </RowGroup>

      <GroupTitle>このアプリについて</GroupTitle>
      <RowGroup>
        {about.map((a, i) => (
          <Row key={a.label} first={i === 0} label={a.label} external={a.external} onClick={() => openExternal(a.url)} />
        ))}
      </RowGroup>

      {guest ? (
        <p style={{ margin: '24px 0 0', height: 18, textAlign: 'center', fontSize: 12, fontWeight: 500, color: color.sub }}>Version {APP_VERSION}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            ログアウト
          </Button>
          <p style={{ margin: 0, height: 18, textAlign: 'center', fontSize: 12, fontWeight: 500, color: color.sub }}>Version {APP_VERSION}</p>
        </div>
      )}

      <ConfirmSheet open={confirm} title="ログアウトしますか？" actionLabel="ログアウト" onConfirm={() => logout()} onCancel={() => setConfirm(false)} />
      {diagnosis && <DiagnosisModal onClose={() => setDiagnosis(false)} />}
    </SubPage>
  );
}
