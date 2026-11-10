import { useEffect, useState } from 'react';
import { color } from '../../theme/tokens';
import { fetchNotifPrefs, updateNotifPrefs } from '../../lib/notifications';
import { requestPushPermissionAndRegister } from '../../lib/push';
import { SubPage, GroupTitle, RowGroup } from './SettingsParts';
import Icon from '../../components/ui/Icon';

// 通知の設定（引き渡し書 §7-6）：マスターのスイッチ・種類ごとのスイッチ
//   マスターをオフにすると、種類ごとのスイッチは押せなくなる（オフのまま変わらない）
function SwitchRow({ label, on, disabled, onChange, first }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="ui-btn ui-btn--text"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: 0,
        border: 0,
        borderTop: first ? 0 : `1px solid ${color.line}`,
        background: 'transparent',
        color: disabled ? color.sub : color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 46,
          height: 28,
          borderRadius: 14,
          background: on && !disabled ? color.ink : color.surface,
          boxSizing: 'border-box',
          border: `1px solid ${on && !disabled ? color.ink : color.lineStrong}`,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: color.white, transition: 'left 0.15s' }} />
      </span>
    </button>
  );
}

export default function NotificationSettingsScreen({ onBack }) {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchNotifPrefs()
      .then((p) => alive && setPrefs(p))
      .catch((err) => {
        console.error('通知設定の取得エラー:', err?.message || err);
        if (alive) setPrefs({ notif_master: true, notif_match: true, notif_member_joined: true, notif_id_invite: true, notif_announcement: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = async (patch) => {
    setPrefs((p) => ({ ...p, ...patch }));
    try {
      await updateNotifPrefs(patch);
      // マスターを初めてオンにしたとき、端末の通知の許可もお願いする
      if (patch.notif_master) requestPushPermissionAndRegister();
    } catch (err) {
      console.error('通知設定の更新エラー:', err?.message || err);
      setError('変更できませんでした。少したってから、もう一度お試しください');
    }
  };

  if (!prefs) return null;
  const master = !!prefs.notif_master;

  return (
    <SubPage title="通知" onBack={onBack}>
      <RowGroup>
        <SwitchRow first label="通知を受け取る" on={master} onChange={(v) => update({ notif_master: v })} />
      </RowGroup>
      <GroupTitle>通知の種類</GroupTitle>
      <RowGroup>
        <SwitchRow first label="マッチした（みんなが同じお店を選んだ）" on={!!prefs.notif_match} disabled={!master} onChange={(v) => update({ notif_match: v })} />
        <SwitchRow label="新しいメンバーがグループに参加した" on={!!prefs.notif_member_joined} disabled={!master} onChange={(v) => update({ notif_member_joined: v })} />
        <SwitchRow label="IDでグループに招待された" on={!!prefs.notif_id_invite} disabled={!master} onChange={(v) => update({ notif_id_invite: v })} />
        <SwitchRow label="運営からのお知らせ" on={!!prefs.notif_announcement} disabled={!master} onChange={(v) => update({ notif_announcement: v })} />
      </RowGroup>
      <p style={{ margin: '16px 0 0', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.6, color: color.sub }}>
        <Icon name="info" size={16} color={color.sub} />
        グループごとの通知は、各グループの「設定」タブからミュートできます。
      </p>
      {error && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>
          {error}
        </p>
      )}
    </SubPage>
  );
}
