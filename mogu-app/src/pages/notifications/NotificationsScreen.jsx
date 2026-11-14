import { useEffect, useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';
import Icon from '../../components/ui/Icon';
import Button from '../../components/ui/Button';
import MoguTypeCard from '../../components/ui/MoguTypeCard';
import BottomSheet from '../../components/ui/BottomSheet';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { blockUser, photoUrlOf, submitReport } from '../../lib/profile';
import { LOGO } from '../../lib/brand';
import { useToast } from '../../components/ui/Toast';
import { fetchNotifications, markNotificationsRead, notificationText, respondInvite } from '../../lib/notifications';

// お知らせ（確定版 Final-10）。一覧（返事待ち／今日／今週／それ以前）・招待の確認・お知らせの本文
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

// 相対時刻（確定版 Final-10：「12分前」「3時間前」「昨日」「2日前」「10月26日」。修正指示書 §3-6）
function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
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

const formatDot = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function iconFor(type) {
  switch (type) {
    case 'group_match':
      return 'heartFill';
    case 'member_joined':
      return 'personAdd';
    case 'id_invite':
      return 'key';
    default:
      return 'bell';
  }
}

// 丸の中身：マッチはお店の写真、運営のお知らせは mogu のロゴ、参加・招待はその人の写真（§3-6 の表）
function photoFor(n) {
  const p = n.payload || {};
  if (n.type === 'group_match' && p.restaurant_photo) return p.restaurant_photo;
  if (n.type === 'announcement') return LOGO.black;
  if (n.type === 'member_joined' && p.avatar_path) return photoUrlOf(p.avatar_path);
  if (n.type === 'id_invite' && p.inviter_avatar_path) return photoUrlOf(p.inviter_avatar_path);
  return null;
}

// 左の丸い写真（48・2ptの線）。運営のお知らせのロゴだけは、丸の中に収める
function RoundPhoto({ n }) {
  const photo = photoFor(n);
  const isLogo = n.type === 'announcement';
  return (
    <span style={{ flex: 'none', width: 48, height: 48, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {photo ? (
        <img src={photo} alt="" style={isLogo ? { width: '66%', height: '66%', objectFit: 'contain' } : { width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Icon name={iconFor(n.type)} size={20} />
      )}
    </span>
  );
}

// 文（14pt・2行まで。名前・グループ名・店名は太字）
function Sentence({ parts }) {
  return (
    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 14, lineHeight: 1.5 }}>
      {parts.map((s, i) => (
        <span key={i} style={s.b ? { fontWeight: 700 } : undefined}>
          {s.t}
        </span>
      ))}
    </span>
  );
}

function Row({ n, onOpen }) {
  const parts = notificationText(n);
  const sub = n.type === 'announcement' ? n.payload?.body : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ui-btn ui-press"
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 20px',
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: 'transparent',
        color: color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <RoundPhoto n={n} />
      <span style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
        <Sentence parts={parts} />
        {sub && <span style={{ display: 'block', fontSize: 14, lineHeight: 1.5, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>{timeLabel(n.createdAt)}</span>
      </span>
      {!n.read && <span aria-label="未読" style={{ position: 'absolute', right: 20, top: 18, width: 10, height: 10, borderRadius: '50%', background: color.red }} />}
    </button>
  );
}

// まとまりの見出し（Dela 16。返事待ちは件数つき）。下を2ptの線で締める
function Section({ title, count, items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionHeading title={title} count={count} />
      {items.map((n) => (
        <Row key={n.id} n={n} onOpen={() => onOpen(n)} />
      ))}
    </div>
  );
}

function SectionHeading({ title, count }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '18px 0 0', padding: '0 20px 8px', borderBottom: `${stroke.shape}px solid ${color.ink}`, fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>
      {title}
      {count != null && <span style={{ fontFamily: font.dela, fontSize: 13 }}>{count}件</span>}
    </h2>
  );
}

// 返事待ち（IDでの招待）の行：タップで招待の確認（⑩-4）、その場でも返事ができる
function PendingRow({ n, onRespond, onOpenConfirm, busy }) {
  return (
    <div style={{ position: 'relative', padding: '14px 20px', borderBottom: `1px solid ${color.line}` }}>
      <button
        type="button"
        onClick={() => onOpenConfirm(n)}
        className="ui-btn ui-press"
        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
      >
        <RoundPhoto n={n} />
        <span style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
          <Sentence parts={notificationText(n)} />
          <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>{timeLabel(n.createdAt)}</span>
        </span>
      </button>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, marginLeft: 60 }}>
        <Button variant="primary" disabled={busy} onClick={() => onRespond(n, true)} style={{ flex: 1 }}>
          参加する
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onRespond(n, false)} style={{ flex: 1 }}>
          断る
        </Button>
      </div>
      {!n.read && <span aria-label="未読" style={{ position: 'absolute', right: 20, top: 18, width: 10, height: 10, borderRadius: '50%', background: color.red }} />}
    </div>
  );
}

// 参加したあとの行（⑩-8）：「◯◯に参加しました」と［グループを見る］
function JoinedRow({ n, onOpenGroup }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <RoundPhoto n={n} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <Sentence parts={notificationText(n)} />
          <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>{timeLabel(n.payload?.respondedAt || n.createdAt)}</span>
        </span>
      </div>
      <div style={{ marginTop: 10, marginLeft: 60 }}>
        <Button variant="secondary" onClick={() => onOpenGroup?.(n.payload?.group_id)}>
          グループを見る
        </Button>
      </div>
    </div>
  );
}

// 招待の確認（⑩-4・5）。招待した人は⑥のパス。「…」は通報・ブロック
function InviteConfirmScreen({ n, busy, onBack, onRespond, toast }) {
  const p = n.payload || {};
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const label = p.inviter_handle ? `@${p.inviter_handle}` : p.inviter_name || '';

  const doBlock = async () => {
    setWorking(true);
    const res = await blockUser(p.inviter_id);
    setWorking(false);
    setBlockConfirm(false);
    if (res?.error) {
      toast?.show('ブロックできませんでした');
      return;
    }
    toast?.show(`${label} さんをブロックしました`);
    onBack();
  };

  return (
    <div style={page}>
      <header style={{ paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderIconButton icon="back" label="戻る" onClick={onBack} />
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>グループへの招待</h1>
          <button
            type="button"
            aria-label="その他（通報・ブロック）"
            onClick={() => setMore(true)}
            className="ui-btn ui-btn--text"
            style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="moreFill" size={22} />
          </button>
        </div>
      </header>
      <div style={body}>
        <div style={{ padding: '10px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 24, fontWeight: 400 }}>{p.group_name || 'グループ'}</h2>
          {p.member_count != null && <p style={{ margin: '4px 0 0', fontSize: 13, color: color.sub }}>{p.member_count}人</p>}
          <p style={{ margin: '22px 0 0', alignSelf: 'flex-start', fontSize: 13, fontWeight: 700 }}>招待した人</p>
          {label && <p style={{ margin: '2px 0 0', alignSelf: 'flex-start', fontSize: 13, color: color.sub }}>{label}</p>}
          <div style={{ marginTop: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
            {p.inviter_mogu_type_code ? (
              <MoguTypeCard
                code={p.inviter_mogu_type_code}
                characterName={p.inviter_mogu_type_character_name}
                nickname={p.inviter_mogu_type_nickname}
                completedAt={p.inviter_mogu_type_completed_at}
              />
            ) : (
              <div style={{ width: '100%', maxWidth: 353, padding: '38px 16px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.line}`, borderRadius: 24, background: color.surface }}>
                <p style={{ margin: 0, fontFamily: font.dela, fontSize: 24, letterSpacing: '0.12em', color: color.sub }}>？？？？</p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: color.sub }}>まだ食スタイル診断をしていません</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 28, width: '100%' }}>
            <Button variant="secondary" disabled={busy} onClick={() => onRespond(n, false)} style={{ flex: 1 }}>
              断る
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => onRespond(n, true)} style={{ flex: 1 }}>
              参加する
            </Button>
          </div>
        </div>
      </div>

      <BottomSheet open={more} onClose={() => setMore(false)} ariaLabel={label}>
        <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>{label}</p>
        <button
          type="button"
          onClick={() => {
            setMore(false);
            setReport(true);
          }}
          style={{ height: 56, borderTop: `1px solid ${color.line}`, borderWidth: '1px 0 0', padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
        >
          <Icon name="flag" size={22} color={color.red} />
          このユーザーを通報する
        </button>
        <button
          type="button"
          onClick={() => {
            setMore(false);
            setBlockConfirm(true);
          }}
          style={{ height: 56, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}`, padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
        >
          <Icon name="block" size={22} color={color.red} />
          このユーザーをブロックする
        </button>
        <Button variant="secondary" onClick={() => setMore(false)} style={{ marginTop: 16 }}>
          キャンセル
        </Button>
      </BottomSheet>

      <ReportSheet open={report} onClose={() => setReport(false)} targetId={p.inviter_id} name={label} toast={toast} />

      <BottomSheet open={blockConfirm} onClose={() => setBlockConfirm(false)} ariaLabel={`${label} さんをブロックしますか？`} minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, textAlign: 'center' }}>{label} さんをブロックしますか？</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, textAlign: 'center', color: color.sub }}>おたがいに招待が送れなくなります。相手には知らせません</p>
        <Button variant="danger" onClick={doBlock} disabled={working} style={{ marginTop: 18 }}>
          ブロックする
        </Button>
        <Button variant="secondary" onClick={() => setBlockConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}

const REASONS = [
  { id: 'photo', label: '不適切な写真' },
  { id: 'profile', label: '不適切な名前・自己紹介' },
  { id: 'impersonation', label: 'なりすまし' },
  { id: 'harassment', label: 'いやがらせ・しつこい招待' },
  { id: 'other', label: 'その他' },
];

function ReportSheet({ open, onClose, targetId, name, toast }) {
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    const res = await submitReport({ kind: 'user', reason, targetUser: targetId });
    setBusy(false);
    onClose();
    if (res?.error) {
      toast?.show('通報を送れませんでした');
      return;
    }
    toast?.show('通報を受け付けました');
  };
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${name} さんを通報する`}>
      <h2 style={{ margin: '14px 0 0', fontFamily: font.dela, fontSize: 18, fontWeight: 400, textAlign: 'center' }}>{name} さんを通報する</h2>
      <div style={{ marginTop: 12 }}>
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReason(r.id)}
            style={{ width: '100%', height: 52, borderTop: `1px solid ${color.line}`, borderWidth: '1px 0 0', padding: '0 4px', background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', fontSize: 15, fontWeight: reason === r.id ? 700 : 400 }}
          >
            {r.label}
            {reason === r.id && <Icon name="check" size={20} />}
          </button>
        ))}
      </div>
      <Button variant="primary" onClick={send} disabled={!reason || busy} style={{ marginTop: 16 }}>
        送信する
      </Button>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 10 }}>
        キャンセル
      </Button>
    </BottomSheet>
  );
}

// 運営のお知らせの本文（⑩-6）
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
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: color.white, border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={LOGO.black} alt="" style={{ width: '66%', height: '66%', objectFit: 'contain' }} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>mogu 運営</span>
              <span style={{ fontSize: 12, color: color.sub }}>{formatDot(n.createdAt)}</span>
            </span>
          </div>
          <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4 }}>{n.payload?.title}</h2>
          <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{n.payload?.body}</p>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsScreen({ onBack, onOpenGroup }) {
  const toast = useToast();
  const [list, setList] = useState(null); // null = 読み込み中
  const [status, setStatus] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null); // announcement
  const [confirm, setConfirm] = useState(null); // 招待の確認（⑩-4）

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
      setList((prev) =>
        (prev || []).map((x) =>
          x.id === n.id ? { ...x, read: true, payload: { ...x.payload, responded: true, accepted: accept, respondedAt: new Date().toISOString() } } : x,
        ),
      );
      setConfirm(null);
      if (accept && res?.groupId) onOpenGroup?.(res.groupId);
    } catch (err) {
      console.error('招待への返事エラー:', err?.message || err);
      toast?.show('返事を送れませんでした');
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
      if (!n.payload?.responded) setConfirm(n);
      return;
    }
    if ((n.type === 'group_match' || n.type === 'member_joined') && n.payload?.group_id) {
      onOpenGroup?.(n.payload.group_id);
    }
  };

  if (confirm) {
    return <InviteConfirmScreen n={confirm} busy={busyId === confirm.id} onBack={() => setConfirm(null)} onRespond={respond} toast={toast} />;
  }
  if (detail) return <AnnouncementDetail n={detail} onBack={() => setDetail(null)} />;

  const empty = status === 'ready' && (list || []).length === 0;
  // 参加した招待は「今日」に「参加しました」の行で残す（⑩-8）
  const renderItem = (n) =>
    n.type === 'id_invite' && n.payload?.accepted ? (
      <JoinedRow key={n.id} n={n} onOpenGroup={onOpenGroup} />
    ) : (
      <Row key={n.id} n={n} onOpen={() => openItem(n)} />
    );

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
            {grouped.pending.length > 0 && (
              <div>
                <SectionHeading title="返事待ち" count={grouped.pending.length} />
                {grouped.pending.map((n) => (
                  <PendingRow key={n.id} n={n} onRespond={respond} onOpenConfirm={setConfirm} busy={busyId === n.id} />
                ))}
              </div>
            )}
            {grouped.today.length > 0 && (
              <div>
                <SectionHeading title="今日" />
                {grouped.today.map(renderItem)}
              </div>
            )}
            <Section title="今週" items={grouped.thisWeek} onOpen={openItem} />
            <Section title="それ以前" items={grouped.earlier} onOpen={openItem} />
          </div>
        </div>
      )}
    </div>
  );
}
