import { useEffect, useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';
import Icon from '../../components/ui/Icon';
import Button from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { fetchNotifications, markNotificationsRead, notificationText, respondInvite } from '../../lib/notifications';

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

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
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

function Row({ n, onOpen }) {
  const { title, body: text } = notificationText(n);
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
      <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={iconFor(n.type)} size={18} />
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

// 返事待ち（IDでの招待）の行：受諾・辞退をその場で押せる
function PendingRow({ n, onRespond, busy }) {
  const inviterName = n.payload?.inviter_name || '友達';
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${color.line}`, background: color.surface }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="key" size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>グループに招待されています</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: color.sub, lineHeight: 1.5 }}>{inviterName}さんから</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, marginLeft: 52 }}>
        <Button variant="primary" disabled={busy} onClick={() => onRespond(n, true)} style={{ flex: 1 }}>
          参加する
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onRespond(n, false)} style={{ flex: 1 }}>
          辞退する
        </Button>
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
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 20, lineHeight: 1.4 }}>{n.payload?.title}</h2>
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
    if ((n.type === 'group_match' || n.type === 'member_joined') && n.payload?.group_id) {
      onOpenGroup?.(n.payload.group_id);
    }
  };

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
              <PendingRow key={n.id} n={n} onRespond={respond} busy={busyId === n.id} />
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
