// 開発用：共通の部品を確定版（Final-15）の見本と同じ並びで組み、見比べるためのページ。
// アプリ本体からは読み込まない（ビルドに入らない）
import { useEffect } from 'react';
import { color, layout } from '../theme/tokens';
import { TitleHeader, BackHeader } from '../components/ui/ScreenHeader';
import TabBar from '../components/ui/TabBar';
import { EmptyState, LoadingState, ErrorState, OfflineBand } from '../components/ui/States';
import ConfirmSheet from '../components/ui/ConfirmSheet';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import TextField from '../components/ui/TextField';
import Avatar from '../components/ui/Avatar';
import TypeLabel from '../components/ui/TypeLabel';

const frame = { position: 'relative', width: 393, height: 852, overflow: 'hidden', background: color.bg, display: 'flex', flexDirection: 'column' };

function ToastDemo() {
  const toast = useToast();
  useEffect(() => {
    toast.show('保存から外しました', { undo: () => {} });
  }, [toast]);
  return null;
}

export default function UiGallery({ f }) {
  const tabProfile = { name: 'もぐたろう' };
  if (f === '1')
    return (
      <div style={frame}>
        <BackHeader title="設定" onBack={() => {}} />
        <div style={{ flex: 1 }} />
        <TabBar active="profile" profile={tabProfile} />
        <ConfirmSheet open title="ログアウトしますか？" actionLabel="ログアウトする" onConfirm={() => {}} onCancel={() => {}} />
      </div>
    );
  if (f === '2')
    return (
      <div style={frame}>
        <TitleHeader title="保存" actions={[{ icon: 'sort', label: '並べ替え' }]} />
        <div style={{ flex: 1 }} />
        <TabBar active="saved" profile={tabProfile} />
        <ToastDemo />
      </div>
    );
  if (f === '3')
    return (
      <div style={frame}>
        <BackHeader title="お知らせ" onBack={() => {}} />
        <EmptyState title="お知らせはまだありません" description={'グループへの招待や、運営からのお知らせが\nここに届きます'} style={{ flex: 1, paddingBottom: 94 }} />
        <TabBar active="home" profile={tabProfile} />
      </div>
    );
  if (f === '4')
    return (
      <div style={frame}>
        <TitleHeader title="グループ" actions={[{ icon: 'plusLarge', label: 'グループを作る・コードで参加' }]} />
        <LoadingState style={{ flex: 1, paddingBottom: 94 }} />
        <TabBar active="group" profile={tabProfile} />
      </div>
    );
  if (f === '5')
    return (
      <div style={frame}>
        <TitleHeader title="保存" actions={[{ icon: 'sort', label: '並べ替え' }]} />
        <OfflineBand description="前に読み込んだお店を表示しています" onRetry={() => {}} />
        <div style={{ flex: 1 }} />
        <TabBar active="saved" profile={tabProfile} />
      </div>
    );
  if (f === '7')
    return (
      <div style={frame}>
        <BackHeader title="アカウント" onBack={() => {}} />
        <div style={{ flex: 1 }} />
        <ConfirmSheet
          open
          danger
          title="アカウントを削除しますか？"
          description="この操作は取り消せません。次のものがすべて消えます。"
          items={['プロフィール', 'スワイプの履歴', '保存したお店', '作ったグループ']}
          note="あなたが作ったグループは、ほかのメンバーがいれば、いちばん早く入った人に引き継がれます。メンバーがいなければ消えます。"
          confirmWord="削除"
          actionLabel="アカウントを削除する"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    );
  if (f === '8')
    return (
      <div style={frame}>
        <div style={{ height: 'calc(var(--safe-top) + 96px)' }} />
        <ErrorState onRetry={() => {}} style={{ flex: 1, paddingBottom: 94 }} />
        <TabBar active="home" profile={tabProfile} />
      </div>
    );
  // 部品の一覧
  return (
    <div style={{ ...frame, height: 'auto', padding: `24px ${layout.screenX}px 140px`, gap: 12, fontFamily: 'var(--f-plex)' }}>
      <Button>主のボタン</Button>
      <Button variant="secondary">副のボタン</Button>
      <Button variant="danger">危険なボタン</Button>
      <Button disabled>押せないとき</Button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="small">更新</Button>
        <Button variant="bar">保存</Button>
        <Button variant="bar" disabled>保存</Button>
      </div>
      <TextField label="メールアドレス" value="sample@example.com" onChange={() => {}} />
      <TextField label="メールアドレス" value="sample@example" onChange={() => {}} error="メールアドレスの形が違います" />
      <TextField label="パスワード" type="password" value="password12" onChange={() => {}} />
      <TextField label="ニックネーム" value="もぐたろう" onChange={() => {}} maxLength={9} showCount />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar size={96} name="もぐたろう" />
        <Avatar size={56} name="はなこ" />
        <Avatar size={40} name="けんと" />
        <Avatar size={40} blocked />
        <Avatar size={40} guest />
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <TypeLabel code="VNBP" />
        <TypeLabel code="TFGL" align="left" date="2026.11.03" />
        <TypeLabel code="TNGL" />
        <TypeLabel code="VFGL" />
      </div>
      <TabBar active="home" guest />
    </div>
  );
}
