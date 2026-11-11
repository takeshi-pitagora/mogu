import { useCallback, useEffect, useMemo, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import BottomSheet from '../../components/ui/BottomSheet';
import { Radio } from '../../components/ui/Radio';
import TypeLabel from '../../components/ui/TypeLabel';
import { BackHeader, HeaderIconButton } from '../../components/ui/ScreenHeader';
import { LOGO } from '../../lib/brand';
import { chara } from '../../lib/chara';
import { getType } from '../../lib/mogutype';
import { blockUser, photoUrlOf, submitReport } from '../../lib/profile';
import { fetchAnnouncement, fetchRestaurantThumbs, listNotifications, markNotificationsRead, respondGroupInvite } from '../../lib/notifications';
import { hasSeenGroupJoinPrompt, markGroupJoinPromptSeen, requestPushPermission } from '../../lib/push';
import NotificationPermissionSheet from '../../components/NotificationPermissionSheet';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

// お知らせ（確定版 Final-10）。3回目：引き渡し書 §7-6・画面ごとの仕様 ⑩
//   見出し「お知らせ」。「返事待ち」→「今日」→「今週」→「それ以前」
//   行：丸い写真（マッチ＝お店の写真／お知らせ＝moguのロゴ）・文・時刻。未読は右はしの赤い点
//   返事待ち：招待の行に［参加する］［断る］。行自体を押すと「招待の確認」が開く
const REASONS = [
  { id: 'photo', label: '不適切な写真' },
  { id: 'profile', label: '不適切な名前・自己紹介' },
  { id: 'impersonation', label: 'なりすまし' },
  { id: 'harassment', label: 'いやがらせ・しつこい招待' },
  { id: 'other', label: 'その他' },
];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function bucketOf(iso) {
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (diffDays <= 0) return '今日';
  if (diffDays < 7) return '今週';
  return 'それ以前';
}
function formatWhen(iso) {
  const d = new Date(iso);
  const sameDay = startOfDay(d) === startOfDay(new Date());
  if (sameDay) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 丸い写真（44）。マッチはお店の写真、なければハート。お知らせはmoguのロゴ
function CircleAvatar({ photoUrl, logo, icon = 'bell', name }) {
  const box = { flex: 'none', width: 44, height: 44, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, overflow: 'hidden', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (logo) {
    return (
      <span style={box}>
        <img src={LOGO.black} alt="" style={{ width: '70%', objectFit: 'contain' }} />
      </span>
    );
  }
  if (photoUrl) {
    return (
      <span style={box}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }
  if (name) return <Avatar size={44} name={name} />;
  return (
    <span style={box}>
      <Icon name={icon} size={20} />
    </span>
  );
}

function Row({ avatar, children, time, unread, onClick }) {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 68, padding: '12px 0', borderTop: `1px solid ${color.line}` }}>
      {avatar}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{children}</div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingTop: 4 }}>
        <span style={{ fontSize: 11, color: color.sub, whiteSpace: 'nowrap' }}>{time}</span>
        {unread && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color.red }} />}
      </div>
    </div>
  );
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} className="ui-btn ui-btn--text" style={{ display: 'block', width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: color.ink, fontFamily: 'inherit' }}>
      {inner}
    </button>
  );
}

function SmallButton({ children, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ui-btn ui-press"
      style={{ height: 36, padding: '0 16px', border: `2px solid ${color.ink}`, borderRadius: 18, background: danger ? color.bg : color.ink, color: danger ? color.ink : color.white, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ margin: '20px 0 0', fontFamily: font.dela, fontSize: 15, fontWeight: 400, color: color.sub }}>{children}</h2>;
}

// 「…」：通報する／ブロックする（通報の理由の選び方は f13-2・f13-15 と同じ並び）
function InviterMoreSheet({ open, onClose, name, onReport, onBlock }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${name} さん`}>
      <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>{name} さん</p>
      <button
        type="button"
        onClick={onReport}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderWidth: '1px 0 0', padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, width: '100%' }}
      >
        <Icon name="flag" size={22} color={color.red} />
        このユーザーを通報する
      </button>
      <button
        type="button"
        onClick={onBlock}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}`, padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, width: '100%' }}
      >
        <Icon name="block" size={22} color={color.red} />
        このユーザーをブロックする
      </button>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 16 }}>
        キャンセル
      </Button>
    </BottomSheet>
  );
}

function ReportInviterSheet({ open, onClose, name, targetId }) {
  const toast = useToast();
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    setReason(null);
    setOtherText('');
    setSent(false);
    onClose?.();
  };
  const send = async () => {
    if (!reason || (reason === 'other' && !otherText.trim())) return;
    setBusy(true);
    const res = await submitReport({ kind: 'user', reason, detail: reason === 'other' ? otherText.trim() : null, targetUser: targetId });
    setBusy(false);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="通報を受け付けました" minHeight={230}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
          <span style={{ display: 'flex', width: 64, height: 64, borderRadius: '50%', background: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={color.white} />
          </span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>通報を受け付けました</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>内容を確認して対応します</p>
        <Button variant="secondary" onClick={close} style={{ marginTop: 22 }}>
          閉じる
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} ariaLabel="通報する">
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: font.dela, fontSize: 18 }}>通報する</div>
        <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{name} さん</div>
      </div>
      {reason === 'other' ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ minHeight: 96, padding: '12px 17px', border: `2px solid ${color.ink}`, borderRadius: 18, background: color.white }}>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
              placeholder="くわしい内容を入れてください"
              rows={3}
              style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65, color: color.ink }}
            />
          </div>
          <Button variant="primary" onClick={send} disabled={busy || !otherText.trim()} style={{ marginTop: 14 }}>
            送信する
          </Button>
        </div>
      ) : (
        <>
          <p style={{ margin: '14px 0 10px', fontSize: 13, fontWeight: 700, color: color.sub }}>あてはまるものを1つ選んでください</p>
          <div role="radiogroup" aria-label="通報の理由" style={{ borderBottom: `1px solid ${color.line}` }}>
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{ flex: '1 1 0%', textAlign: 'left', fontSize: 16, fontWeight: reason === r.id ? 700 : 500 }}>{r.label}</span>
                <Radio on={reason === r.id} />
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={busy || !reason || reason === 'other'} onClick={send} style={{ marginTop: 20 }}>
            送信する
          </Button>
        </>
      )}
    </BottomSheet>
  );
}

// 招待の確認（画面ごとの仕様 ⑩。確定版の見本は未確認のため、他画面＝プロフィール・設定の部品に合わせた暫定レイアウト）
function InviteConfirmScreen({ item, onBack, onAccept, onDecline, busy }) {
  const p = item.payload || {};
  const type = getType(p.inviter_type_code);
  const ch = type ? chara(type.code) : null;
  const name = p.inviter_display_name || p.inviter_handle || '';
  const diagnosedOn = p.inviter_type_linked_at ? new Date(p.inviter_type_linked_at) : null;
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const toast = useToast();

  const doBlock = async () => {
    setBlockConfirm(false);
    const res = await blockUser(p.inviter_id);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    toast?.show('ブロックしました');
    onDecline();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="グループへの招待" onBack={onBack} right={<HeaderIconButton icon="moreFill" label="その他" onClick={() => setMore(true)} />} />
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '24px 20px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400, textAlign: 'center' }}>{p.group_name || 'グループ'}</h1>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
            {ch ? (
              <img src={ch.framed} alt="" style={{ display: 'block', width: 80, height: 122, objectFit: 'contain', objectPosition: 'center bottom' }} />
            ) : (
              <Avatar size={56} photoUrl={photoUrlOf(p.inviter_avatar_path)} name={name} />
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: color.sub }}>招待した人</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 700 }}>{name}</div>
              {type && <TypeLabel code={type.code} align="left" date={diagnosedOn ? `${diagnosedOn.getFullYear()}年${diagnosedOn.getMonth() + 1}月${diagnosedOn.getDate()}日診断` : undefined} />}
            </div>
          </div>

          <div style={{ marginTop: 32, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button onClick={() => onAccept(item)} disabled={busy}>
              参加する
            </Button>
            <Button variant="secondary" onClick={() => onDecline(item)} disabled={busy}>
              断る
            </Button>
          </div>
        </div>
      </div>
      <InviterMoreSheet
        open={more}
        onClose={() => setMore(false)}
        name={name}
        onReport={() => {
          setMore(false);
          setReport(true);
        }}
        onBlock={() => {
          setMore(false);
          setBlockConfirm(true);
        }}
      />
      <ReportInviterSheet open={report} onClose={() => setReport(false)} name={name} targetId={p.inviter_id} />
      <BottomSheet open={blockConfirm} onClose={() => setBlockConfirm(false)} ariaLabel={`${name} さんをブロックしますか？`} minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4, textAlign: 'center' }}>{name} さんを<br />ブロックしますか？</h2>
        <Button variant="danger" onClick={doBlock} style={{ marginTop: 18 }}>
          ブロックする
        </Button>
        <Button variant="secondary" onClick={() => setBlockConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}

// お知らせの本文（画面ごとの仕様 ⑩「mogu運営」・日付・タイトル・本文。広告のように大きくしない）
function AnnouncementBodyScreen({ announcementId, onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchAnnouncement(announcementId)
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [announcementId]);
  const d = data?.published_at ? new Date(data.published_at) : null;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="お知らせ" onBack={onBack} />
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '20px 20px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CircleAvatar logo />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>mogu運営</div>
              {d && <div style={{ fontSize: 11, color: color.sub }}>{d.getFullYear()}年{d.getMonth() + 1}月{d.getDate()}日</div>}
            </div>
          </div>
          {data && (
            <>
              <h1 style={{ margin: '20px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4 }}>{data.title}</h1>
              <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{data.body}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsScreen({ onBack, onOpenGroup }) {
  const { updateProfile } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null); // null = 読み込み中
  const [thumbs, setThumbs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState(null); // null | { kind: 'invite', item } | { kind: 'announcement', id }
  const [permSheet, setPermSheet] = useState(false);

  const load = useCallback(
    () =>
      listNotifications()
        .catch(() => [])
        .then((data) => {
          setItems(data);
          const matchIds = data.filter((n) => n.type === 'group_match').map((n) => n.payload?.restaurant_id);
          if (matchIds.length) {
            fetchRestaurantThumbs(matchIds)
              .then(setThumbs)
              .catch(() => {});
          }
          markNotificationsRead(null).catch(() => {});
        }),
    []
  );

  useEffect(() => {
    let alive = true;
    listNotifications()
      .catch(() => [])
      .then((data) => {
        if (!alive) return;
        setItems(data);
        const matchIds = data.filter((n) => n.type === 'group_match').map((n) => n.payload?.restaurant_id);
        if (matchIds.length) {
          fetchRestaurantThumbs(matchIds)
            .then((m) => alive && setThumbs(m))
            .catch(() => {});
        }
        markNotificationsRead(null).catch(() => {});
      });
    return () => {
      alive = false;
    };
  }, []);

  const afterGroupJoined = useCallback(() => {
    if (!hasSeenGroupJoinPrompt()) setPermSheet(true);
  }, []);

  const accept = async (item) => {
    setBusyId(item.id);
    try {
      await respondGroupInvite(item.payload.invite_id, true);
      await load();
      toast?.show('参加しました');
      setView(null);
      afterGroupJoined();
    } catch {
      toast?.show('参加できませんでした。時間をおいてもう一度お試しください');
    } finally {
      setBusyId(null);
    }
  };
  const decline = async (item) => {
    setBusyId(item.id);
    try {
      await respondGroupInvite(item.payload.invite_id, false);
      await load();
      setView(null);
    } catch {
      toast?.show('通信に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  const enablePush = async () => {
    markGroupJoinPromptSeen();
    setPermSheet(false);
    await updateProfile({ notifEnabled: true });
    await requestPushPermission();
  };
  const dismissPush = () => {
    markGroupJoinPromptSeen();
    setPermSheet(false);
  };

  const grouped = useMemo(() => {
    if (!items) return null;
    const pending = [];
    const buckets = { 今日: [], 今週: [], それ以前: [] };
    items.forEach((n) => {
      if (n.type === 'group_id_invite' && n.invite_status === 'pending') {
        pending.push(n);
        return;
      }
      buckets[bucketOf(n.created_at)].push(n);
    });
    return { pending, buckets };
  }, [items]);

  if (view?.kind === 'invite') {
    return <InviteConfirmScreen item={view.item} onBack={() => setView(null)} onAccept={accept} onDecline={decline} busy={busyId === view.item.id} />;
  }
  if (view?.kind === 'announcement') {
    return <AnnouncementBodyScreen announcementId={view.id} onBack={() => setView(null)} />;
  }

  const isEmpty = grouped && grouped.pending.length === 0 && Object.values(grouped.buckets).every((b) => b.length === 0);

  const renderRow = (n) => {
    const p = n.payload || {};
    const unread = !n.read_at;
    if (n.type === 'group_match') {
      return (
        <Row key={n.id} avatar={<CircleAvatar photoUrl={thumbs[p.restaurant_id]} icon="heartFill" />} time={formatWhen(n.created_at)} unread={unread} onClick={() => onOpenGroup?.(p.group_id, 'shop')}>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>
            「{p.group_name}」でマッチしました。<b>{p.restaurant_name}</b>
          </span>
        </Row>
      );
    }
    if (n.type === 'group_join') {
      return (
        <Row key={n.id} avatar={<CircleAvatar name={p.display_name} />} time={formatWhen(n.created_at)} unread={unread} onClick={() => onOpenGroup?.(p.group_id, 'members')}>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>
            {p.display_name}さんが「{p.group_name}」に参加しました
          </span>
        </Row>
      );
    }
    if (n.type === 'group_id_invite') {
      if (n.invite_status === 'accepted') {
        return (
          <Row key={n.id} avatar={<CircleAvatar name={p.inviter_display_name} photoUrl={photoUrlOf(p.inviter_avatar_path)} />} time={formatWhen(n.created_at)} unread={unread}>
            <span style={{ fontSize: 14, lineHeight: 1.6, display: 'block' }}>「{p.group_name}」に参加しました</span>
            <div style={{ marginTop: 8 }}>
              <SmallButton onClick={() => onOpenGroup?.(p.group_id, 'members')}>グループを見る</SmallButton>
            </div>
          </Row>
        );
      }
      if (n.invite_status === 'declined') {
        return (
          <Row key={n.id} avatar={<CircleAvatar name={p.inviter_display_name} photoUrl={photoUrlOf(p.inviter_avatar_path)} />} time={formatWhen(n.created_at)} unread={unread}>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: color.sub }}>「{p.group_name}」への招待を辞退しました</span>
          </Row>
        );
      }
      return null; // pending は別セクションで描く
    }
    if (n.type === 'announcement') {
      return (
        <Row key={n.id} avatar={<CircleAvatar logo />} time={formatWhen(n.created_at)} unread={unread} onClick={() => setView({ kind: 'announcement', id: p.announcement_id })}>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>{p.title}</span>
        </Row>
      );
    }
    return null;
  };

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="お知らせ" onBack={onBack} />
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '0 20px 130px' }}>
          {!grouped ? null : isEmpty ? (
            <div role="status" style={{ marginTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ width: 96, height: 96, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bell" size={44} />
              </span>
              <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 20 }}>お知らせはまだありません</p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: color.sub, lineHeight: 1.6 }}>グループへの招待や、運営からのお知らせがここに届きます</p>
            </div>
          ) : (
            <>
              {grouped.pending.length > 0 && (
                <>
                  <SectionTitle>返事待ち</SectionTitle>
                  {grouped.pending.map((n) => {
                    const p = n.payload || {};
                    return (
                      <Row
                        key={n.id}
                        avatar={<CircleAvatar name={p.inviter_display_name} photoUrl={photoUrlOf(p.inviter_avatar_path)} />}
                        time={formatWhen(n.created_at)}
                        unread={!n.read_at}
                        onClick={() => setView({ kind: 'invite', item: n })}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1.6, display: 'block' }}>
                          {p.inviter_display_name}さんから、「{p.group_name}」への招待
                        </span>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <SmallButton onClick={() => accept(n)} disabled={busyId === n.id}>
                            参加する
                          </SmallButton>
                          <SmallButton danger onClick={() => decline(n)} disabled={busyId === n.id}>
                            断る
                          </SmallButton>
                        </div>
                      </Row>
                    );
                  })}
                </>
              )}
              {['今日', '今週', 'それ以前'].map((key) =>
                grouped.buckets[key].length > 0 ? (
                  <div key={key}>
                    <SectionTitle>{key}</SectionTitle>
                    {grouped.buckets[key].map(renderRow)}
                  </div>
                ) : null
              )}
            </>
          )}
        </div>
      </div>
      <NotificationPermissionSheet open={permSheet} onClose={dismissPush} onEnable={enablePush} />
    </div>
  );
}
