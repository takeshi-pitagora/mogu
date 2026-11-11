import { useEffect, useState } from 'react';
import { color, font } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { pushPermissionStatus, requestPushPermission } from '../../lib/push';
import Switch from '../../components/ui/Switch';
import Button from '../../components/ui/Button';
import { GroupTitle, SubPage } from './SettingsParts';

// 設定の中「通知」（確定版 f05-通知。3回目）
//   ［通知を受け取る］の大きいスイッチ、種類ごとのオン・オフ（それぞれ説明1行つき。お知らせだけ初めはオフ）
//   iPhoneでオフのときは「iPhoneの設定で、moguの通知がオフになっています」［iPhoneの設定を開く］
const KINDS = [
  { key: 'notifMatch', label: 'グループでマッチ', desc: 'メンバー全員がいいねしたお店があるとき' },
  { key: 'notifJoin', label: 'メンバーの参加', desc: '自分のグループに誰かが入ったとき' },
  { key: 'notifIdInvite', label: 'IDでの招待', desc: 'ユーザーIDで、グループに招待されたとき' },
  { key: 'notifAnnounce', label: '運営からのお知らせ', desc: '新機能など、mogu運営からのお知らせ' },
];

function Row({ title, desc, on, disabled, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderTop: `1px solid ${color.line}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: color.sub }}>{desc}</div>
      </div>
      <Switch on={on} disabled={disabled} onChange={onChange} label={title} />
    </div>
  );
}

export default function NotificationSettingsScreen({ onBack }) {
  const { user, updateProfile } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [systemOff, setSystemOff] = useState(false);

  useEffect(() => {
    let alive = true;
    pushPermissionStatus().then((s) => {
      if (alive) setSystemOff(s === 'denied');
    });
    return () => {
      alive = false;
    };
  }, []);

  const set = async (key, value) => {
    setBusyKey(key);
    await updateProfile({ [key]: value });
    if (key === 'notifEnabled' && value) {
      const result = await requestPushPermission();
      setSystemOff(result === 'denied');
    }
    setBusyKey(null);
  };

  const openIosSettings = () => {
    // iOS では自分のアプリの設定画面を直接開く標準APIがないため、設定アプリのトップを開く
    window.open('App-Prefs:root=NOTIFICATIONS_ID', '_system');
  };

  return (
    <SubPage title="通知" onBack={onBack}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', border: `2px solid ${color.ink}`, borderRadius: 24, background: color.white }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: font.dela, fontSize: 17 }}>通知を受け取る</div>
        <Switch on={!!user?.notifEnabled} disabled={busyKey === 'notifEnabled'} onChange={(v) => set('notifEnabled', v)} label="通知を受け取る" />
      </div>

      {systemOff && (
        <div style={{ marginTop: 14, padding: 16, borderRadius: 20, background: color.surface }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>iPhoneの設定で、moguの通知がオフになっています</p>
          <Button variant="secondary" onClick={openIosSettings} style={{ marginTop: 10 }}>
            iPhoneの設定を開く
          </Button>
        </div>
      )}

      <GroupTitle>受け取る通知</GroupTitle>
      <div>
        {KINDS.map((k) => (
          <Row
            key={k.key}
            title={k.label}
            desc={k.desc}
            on={!!user?.[k.key]}
            disabled={busyKey === k.key || !user?.notifEnabled}
            onChange={(v) => set(k.key, v)}
          />
        ))}
      </div>
    </SubPage>
  );
}
