import { useEffect, useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';
import Icon from '../../components/ui/Icon';
import Button from '../../components/ui/Button';
import MoguTypeCard from '../../components/ui/MoguTypeCard';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { photoUrlOf } from '../../lib/profile';
import { LOGO } from '../../lib/brand';
import { fetchNotifications, markNotificationsRead, notificationText, respondInvite } from '../../lib/notifications';
import OtherProfileScreen from '../profile/OtherProfileScreen';

// お知らせ（確定版 Final-10）。3回目：通知の仕組みができたので、一覧（返事待ち／今日／今週／それ以前）を出す
//   マッチ・新しいメンバー・IDでの招待（受諾/辞退）・運営のお知らせ の4種類（引き渡し書 §7-6）
//   0件のときは今までどおり、ベルのクリームの丸と「お知らせはまだありません」

const page = { position: 'relative', height: '100%', background: color.bg, fontFamily: font.plex, color: color.ink, display: 'flex', flexDirection: 'column' };
const body = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfWeek() {
  const d = startOfToday();
  d.setDate(d.getDate() - 6);
  return d;
}

function groupByWhen(list) {
  const pending = list.filter((n) => n.type === 'id_invite' && !n.payload?.responded);
  const rest = list.filter((n) => !(n.type === 'id_invite' && !n.payload?.responded));
  const today = startOfToday();
  const week = startOfWeek();
  const buckets = { today: [], thisWeek: [], earlier: [] };
  rest.forEach((n) => {
    const t = new Date(n.createdAt);
    if (t >= today) buckets.today.push(n);
    else if (t >= week) buckets.thisWeek.push(n);
    else buckets.earlier.push(n);
  });
  return { pending, ...buckets };
}

// 相対時刻（確定版 Final-10：「12分前」「3時間前」「昨日」「2日前」「10月26日」。4回目 §3-4）
function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24 && d.toDateString() === now.toDateString()) return `${diffHour}時間前`;
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 1) return '昨日';
  if (diffDays >= 2 && diffDays <= 6) return `${diffDays}日前`;
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function iconFor(type) {
  switch (type) {
    case 'group_match':
      return 'heartFill';
    case 'member_joined':
      return 'personAdd';
    case 'id_invite':
      return 'key';
    case 'announcement':
      return 'bell';
    default:
      return 'bell';
  }
}

// 丸アイコンの中身：マッチはお店の写真、お知らせはmoguロゴ、参加・招待はその人のアバター（4回目 §3-4）
function photoFor(n) {
  const p = n.payload || {};
  if (n.type === 'group_match' && p.restaurant_photo) return p.restaurant_photo;
  if (n.type === 'announcement') return LOGO.black;
  if (n.type === 'member_joined' && p.avatar_path) return photoUrlOf(p.avatar_path);
  if (n.type === 'id_invite' && p.inviter_avatar_path) return photoUrlOf(p.inviter_avatar_path);
  return null;
}

function Row({ n, onOpen }) {
  const { title, body: text } = notificationText(n);
  const photo = photoFor(n);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ui-btn ui-press"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 20px',
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: n.read ? 'transparent' : color.surface,
        color: color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 'none', width: 44, height: 44, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={iconFor(n.type)} size={18} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: color.sub, lineHeight: 1.5 }}>{text}</span>
      </span>
      <span style={{ flex: 'none', fontSize: 11, color: color.sub, whiteSpace: 'nowrap' }}>{timeLabel(n.createdAt)}</span>
      {!n.read && <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: 14, width: 8, height: 8, borderRadius: '50%', background: color.red }} />}
    </button>
  );
}

function Section({ title, items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 style={{ margin: '14px 0 0', padding: '0 20px', fontFamily: font.dela, fontSize: 14, fontWeight: 400, color: color.sub }}>{title}</h2>
      {items.map((n) => (
        <Row key={n.id} n={n} onOpen={() => onOpen(n)} />
      ))}
    </div>
  );
}

// 返事待ち（IDでの招待）の行：タップで確認画面、その場でも受諾・辞退できる（4回目 §3-4：招待確認を追加）
function PendingRow({ n, onRespond, onOpenConfirm, busy }) {
  const p = n.payload || {};
  const inviterLabel = p.inviter_handle ? `@${p.inviter_handle}` : p.inviter_name || '友達';
  const avatar = p.inviter_avatar_path ? photoUrlOf(p.inviter_avatar_path) : null;
  return (
    <button
      type="button"
      onClick={() => onOpenConfirm(n)}
      className="ui-btn ui-press"
      style={{ width: '100%', padding: '14px 20px', border: 0, borderBottom: `1px solid ${color.line}`, background: color.surface, color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="key" size={18} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{p.group_name || 'グループ'}への招待</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: color.sub, lineHeight: 1.5 }}>{inviterLabel}さんから</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, marginLeft: 52 }}>
        <Button variant="primary" disabled={busy} onClick={(e) => { e.stopPropagation(); onRespond(n, true); }} style={{ flex: 1 }}>
          参加する
        </Button>
        <Button variant="secondary" disabled={busy} onClick={(e) => { e.stopPropagation(); onRespond(n, false); }} style={{ flex: 1 }}>
          辞退する
        </Button>
      </div>
    </button>
  );
}

// 招待の確認（4回目 §3-4：受け取った側がよく見て決められるように、専用の確認画面を追加）
function InviteConfirmScreen({ n, busy, onBack, onRespond, onOpenProfile }) {
  const p = n.payload || {};
  const inviterLabel = p.inviter_handle ? `@${p.inviter_handle}` : '';
  const hasType = !!p.inviter_mogu_type_code;
  return (
    <div style={page}>
      <header style={{ paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>グループへの招待</h1>
          <button
            type="button"
            aria-label="その他（通報・ブロック）"
            onClick={() => onOpenProfile(p.inviter_id)}
            className="ui-btn ui-btn--text"
            style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="moreFill" size={22} />
          </button>
        </div>
      </header>
      <div style={body}>
        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {inviterLabel && <strong>{inviterLabel}</strong>}
            さんから
            <br />
            <strong style={{ fontFamily: font.dela }}>{p.group_name || 'グループ'}</strong>
            に招待されています
          </p>
          <div style={{ marginTop: 20 }}>
            {hasType ? (
              <MoguTypeCard code={p.inviter_mogu_type_code} characterName={p.inviter_mogu_type_character_name} nickname={p.inviter_mogu_type_nickname} />
            ) : (
              <div style={{ width: 280, padding: '40px 16px', border: `${stroke.shape}px solid ${color.line}`, borderRadius: 24, background: color.surface, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 14, color: color.sub }}>？？？？</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: color.sub }}>まだ食スタイル診断をしていません</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 28, width: '100%', maxWidth: 320 }}>
            <Button variant="secondary" disabled={busy} onClick={() => onRespond(n, false)} style={{ flex: 1 }}>
              断る
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => onRespond(n, true)} style={{ flex: 1 }}>
              参加する
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 運営のお知らせの詳細（確定版 §7-6：タップで本文を開く）
function AnnouncementDetail({ n, onBack }) {
  return (
    <div style={page}>
      <header style={{ paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>お知らせ</h1>
          <span style={{ width: 44 }} />
        </div>
      </header>
      <div style={body}>
        <div style={{ padding: '8px 20px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={LOGO.black} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>mogu 運営</span>
              <span style={{ fontSize: 11, color: color.sub }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }) : ''}</span>
            </span>
          </div>
          <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 20, lineHeight: 1.4 }}>{n.payload?.title}</h2>
          <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{n.payload?.body}</p>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsScreen({ onBack, onOpenGroup }) {
  const [list, setList] = useState(null); // null = 読み込み中
  const [status, setStatus] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null); // announcement
  const [confirm, setConfirm] = useState(null); // 招待の確認（id_invite）
  const [profileUserId, setProfileUserId] = useState(null); // 「…」→相手のプロフィール

  useEffect(() => {
    let alive = true;
    fetchNotifications()
      .then((rows) => {
        if (!alive) return;
        setList(rows);
        setStatus('ready');
        const unreadIds = rows.filter((r) => r.kind === 'notification' && !r.read).map((r) => r.rawId);
        if (unreadIds.length > 0) markNotificationsRead(unreadIds).catch(() => {});
      })
      .catch((err) => {
        console.error('お知らせの取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => groupByWhen(list || []), [list]);

  const respond = async (n, accept) => {
    setBusyId(n.id);
    try {
      const res = await respondInvite(n.rawId, accept);
      setList((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, payload: { ...x.payload, responded: true } } : x)));
      setConfirm(null);
      if (accept && res?.groupId) onOpenGroup?.(res.groupId);
    } catch (err) {
      console.error('招待への返事エラー:', err?.message || err);
    } finally {
      setBusyId(null);
    }
  };

  const openItem = (n) => {
    if (n.type === 'announcement') {
      setDetail(n);
      return;
    }
    if (n.type === 'id_invite') {
      setConfirm(n);
      return;
    }
    if ((n.type === 'group_match' || n.type === 'member_joined') && n.payload?.group_id) {
      onOpenGroup?.(n.payload.group_id);
    }
  };

  if (profileUserId) return <OtherProfileScreen userId={profileUserId} onBack={() => setProfileUserId(null)} />;
  if (confirm) {
    return (
      <InviteConfirmScreen
        n={confirm}
        busy={busyId === confirm.id}
        onBack={() => setConfirm(null)}
        onRespond={respond}
        onOpenProfile={(userId) => setProfileUserId(userId)}
      />
    );
  }
  if (detail) return <AnnouncementDetail n={detail} onBack={() => setDetail(null)} />;

  const empty = status === 'ready' && (list || []).length === 0;

  return (
    <div style={page}>
      <header style={{ paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>お知らせ</h1>
          <span style={{ width: 44 }} />
        </div>
      </header>

      {status === 'loading' && <LoadingState style={{ flex: 1 }} />}
      {status === 'error' && (
        <ErrorState
          kind="server"
          onRetry={() => {
            setStatus('loading');
            fetchNotifications()
              .then((rows) => {
                setList(rows);
                setStatus('ready');
              })
              .catch(() => setStatus('error'));
          }}
          style={{ flex: 1 }}
        />
      )}

      {empty && (
        <div role="status" style={{ position: 'absolute', left: 32, right: 32, top: 'calc(var(--safe-top) + 304px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ width: 96, height: 96, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={44} />
          </span>
          <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 20 }}>お知らせはまだありません</p>
        </div>
      )}

      {status === 'ready' && !empty && (
        <div style={body}>
          <div style={{ paddingBottom: 130 }}>
            {grouped.pending.map((n) => (
              <PendingRow key={n.id} n={n} onRespond={respond} onOpenConfirm={setConfirm} busy={busyId === n.id} />
            ))}
            <Section title="今日" items={grouped.today} onOpen={openItem} />
            <Section title="今週" items={grouped.thisWeek} onOpen={openItem} />
            <Section title="それ以前" items={grouped.earlier} onOpen={openItem} />
          </div>
        </div>
      )}
    </div>
  );
}
