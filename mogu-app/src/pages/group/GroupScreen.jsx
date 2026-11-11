import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { TitleHeader } from '../../components/ui/ScreenHeader';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmSheet from '../../components/ui/ConfirmSheet';
import GroupAvatar from '../../components/ui/GroupAvatar';
import { Radio } from '../../components/ui/Radio';
import Switch from '../../components/ui/Switch';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { chara } from '../../lib/chara';
import { getType } from '../../lib/mogutype';
import { shopPhotos, budgetLabel, genreLabel } from '../../lib/shop';
import { canShare, saveImageDataUrl, shareText } from '../../lib/open';
import { buildInvitePosterDataUrl } from '../../lib/invitePoster';
import {
  createGroup,
  createInvite,
  findUserByHandle,
  groupBoardFull,
  groupMarkSeen,
  groupMembers,
  groupToggleHeart,
  groupUnseenShopsFull,
  inviteByHandle,
  joinByCode,
  leaveGroup,
  listGroups,
  previewInvite,
  renameGroup,
  setGroupMuted,
  setGroupPinned,
} from '../../lib/groups';
import { submitReport } from '../../lib/profile';
import { hasSeenGroupJoinPrompt, markGroupJoinPromptSeen, requestPushPermission } from '../../lib/push';
import NotificationPermissionSheet from '../../components/NotificationPermissionSheet';
import OtherProfileScreen from '../profile/OtherProfileScreen';
import { SubHeader } from '../settings/SettingsParts';

// グループ（確定版 Final-11）
//   一覧：検索・ピン留め・動きのないグループのまとめ・まだ見ていないお店の数。＋で作る・コードで参加
//   詳細：「お店」（流れ・ボード）「メンバー」「設定」（名前を変える・このグループの通知・ピン留め・通報・抜ける）
//   招待：LINEなどで送る・招待コード／QRコード／IDで招待
//   §7-5・§7-6・§7-7（3回目：グループと通知）
const GROUP_NAME_MAX = 20;
const STALE_DAYS = 30;

const page = { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink };
const body = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' };

// 一覧の行（確定版 Final-11 の 1）。長押しで［ピン留め］［このグループの通知をオフ］［グループから抜ける］
const LONG_PRESS_MS = 480;
function GroupRow({ g, inUse, onOpen, onLongPress }) {
  const names = (g.members || []).map((m) => m.display_name).filter(Boolean);
  const timer = useRef(null);
  const start = () => {
    timer.current = setTimeout(() => onLongPress?.(), LONG_PRESS_MS);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      className="ui-btn ui-press"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: 'transparent',
        color: color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ position: 'relative', flex: 'none' }}>
        <GroupAvatar members={g.members} size={56} />
        {g.pinned && (
          <span aria-hidden="true" style={{ position: 'absolute', left: -4, top: -4, width: 22, height: 22, borderRadius: '50%', background: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${color.bg}` }}>
            <Icon name="pin" size={12} color={color.white} />
          </span>
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
          {g.count != null && <span style={{ marginLeft: 4, fontSize: 13, color: color.sub }}>（{g.count}）</span>}
          {inUse && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, fontSize: 11, fontWeight: 700, color: color.ink }}>
              <Icon name="check" size={13} />
              使用中
            </span>
          )}
          {g.muted && <Icon name="bellOff" size={14} color={color.sub} style={{ marginLeft: 6 }} />}
        </div>
        {names.length > 0 && (
          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>メンバー：{names.join('・')}</div>
        )}
        {g.lastEvent && (
          <div style={{ marginTop: 2, fontSize: 12, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.lastEvent}が追加されました</div>
        )}
      </div>
      {!!g.unseenCount && (
        <span aria-label={`まだ見ていないお店 ${g.unseenCount}件`} style={{ flex: 'none', minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box', borderRadius: 11, background: color.red, color: color.white, fontFamily: font.dela, fontSize: 12, fontWeight: 400, lineHeight: '22px', textAlign: 'center' }}>
          {g.unseenCount}
        </span>
      )}
    </button>
  );
}

// 長押しのメニュー（確定版 Final-11）：［ピン留め］／［ピン留めを外す］［このグループの通知をオフ／オン］［グループから抜ける］（赤）［キャンセル］
function GroupRowMenu({ group, onClose, onTogglePin, onToggleMute, onLeave }) {
  const item = (icon, label, onClick, danger) => (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-press"
      style={{ width: '100%', height: 56, padding: '0 4px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: danger ? color.red : color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <Icon name={icon} size={22} color={danger ? color.red : color.ink} />
      {label}
    </button>
  );
  return (
    <BottomSheet open onClose={onClose} ariaLabel={group.name}>
      <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>{group.name}</p>
      {item('pin', group.pinned ? 'ピン留めを外す' : 'ピン留め', onTogglePin)}
      {item('bellOff', group.muted ? 'このグループの通知をオン' : 'このグループの通知をオフ', onToggleMute)}
      {item('leave', 'グループから抜ける', onLeave, true)}
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 16 }}>
        キャンセル
      </Button>
    </BottomSheet>
  );
}

// 右上の＋のメニュー（確定版 Final-11 の 4）
function PlusMenu({ onCreate, onJoin, onClose }) {
  const item = (icon, label, onClick, last) => (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="ui-btn ui-press"
      style={{
        width: '100%',
        height: 56,
        padding: '0 16px',
        border: 0,
        borderBottom: last ? 0 : `1px solid ${color.line}`,
        background: 'transparent',
        color: color.ink,
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon} size={22} />
      {label}
    </button>
  );
  return (
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(46,44,42,0.16)', zIndex: 6 }} />
      <div
        role="menu"
        style={{
          position: 'absolute',
          right: 12,
          top: 'calc(var(--safe-top) + 50px)',
          width: 232,
          boxSizing: 'border-box',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderRadius: 20,
          background: color.white,
          overflow: 'hidden',
          zIndex: 7,
        }}
      >
        {item('plusLarge', 'グループを作る', onCreate)}
        {item('key', 'コードで参加', onJoin, true)}
      </div>
    </>
  );
}

function GroupList({ groups, status, selectedId, onRetry, onOpen, onCreate, onJoin, onTogglePin, onToggleMute, onLeave }) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null); // 長押しのメニュー（group）
  const [leaveConfirm, setLeaveConfirm] = useState(null); // 長押し→抜ける の確認
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => [g.name, ...(g.members || []).map((m) => m.display_name)].filter(Boolean).some((t) => String(t).toLowerCase().includes(q)));
  }, [groups, query]);
  // 動きのないグループ（30日以上）は下にまとめる（確定版 Final-11）
  const { active, stale } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- 表示の並び替えだけに使う現在時刻（決定的である必要はない)
    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const a = [];
    const s = [];
    visible.forEach((g) => {
      const t = g.lastActivityAt ? new Date(g.lastActivityAt).getTime() : null;
      (t && t < cutoff ? s : a).push(g);
    });
    return { active: a, stale: s };
  }, [visible]);
  const empty = status === 'ready' && groups.length === 0;

  return (
    <div style={page}>
      <TitleHeader title="グループ" actions={[]} />
      {/* ＋（メニューを開いている間は黒い丸） */}
      <button
        type="button"
        aria-label="グループを作る・コードで参加"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="ui-btn"
        style={{
          position: 'absolute',
          right: 8,
          top: 'calc(var(--safe-top) + 5px)',
          width: 44,
          height: 44,
          border: 0,
          padding: 0,
          borderRadius: '50%',
          background: menu ? color.ink : 'transparent',
          color: menu ? color.white : color.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 8,
        }}
      >
        <Icon name="plusLarge" size={24} />
      </button>
      {menu && (
        <PlusMenu
          onClose={() => setMenu(false)}
          onCreate={() => {
            setMenu(false);
            onCreate();
          }}
          onJoin={() => {
            setMenu(false);
            onJoin();
          }}
        />
      )}

      {empty ? (
        <GroupEmpty onCreate={onCreate} onJoin={onJoin} />
      ) : (
        <div style={body}>
          <div
            role="search"
            style={{
              margin: '12px 20px 4px',
              height: 48,
              boxSizing: 'border-box',
              padding: '0 14px',
              border: `${stroke.shape}px solid ${color.ink}`,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="search" size={20} color={color.sub} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="グループ名・メンバーで探す"
              aria-label="グループ名・メンバーで探す"
              style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, padding: 0 }}
            />
          </div>
          {status === 'loading' && <LoadingState style={{ paddingTop: 80 }} />}
          {status === 'error' && <ErrorState kind="server" onRetry={onRetry} style={{ paddingTop: 60 }} />}
          {status === 'ready' && (
            <div style={{ paddingBottom: 130 }}>
              {active.map((g) => (
                <GroupRow key={g.id} g={g} inUse={selectedId === g.id} onOpen={() => onOpen(g)} onLongPress={() => setRowMenu(g)} />
              ))}
              {stale.length > 0 && (
                <>
                  <h2 style={{ margin: '18px 0 0', padding: '0 20px', fontFamily: font.dela, fontSize: 14, fontWeight: 400, color: color.sub }}>最近動きのないグループ</h2>
                  {stale.map((g) => (
                    <GroupRow key={g.id} g={g} inUse={selectedId === g.id} onOpen={() => onOpen(g)} onLongPress={() => setRowMenu(g)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {rowMenu && (
        <GroupRowMenu
          group={rowMenu}
          onClose={() => setRowMenu(null)}
          onTogglePin={() => {
            onTogglePin(rowMenu);
            setRowMenu(null);
          }}
          onToggleMute={() => {
            onToggleMute(rowMenu);
            setRowMenu(null);
          }}
          onLeave={() => {
            setLeaveConfirm(rowMenu);
            setRowMenu(null);
          }}
        />
      )}
      <ConfirmSheet
        open={!!leaveConfirm}
        title="グループから抜けますか？"
        actionLabel="グループから抜ける"
        danger
        onConfirm={() => {
          onLeave(leaveConfirm);
          setLeaveConfirm(null);
        }}
        onCancel={() => setLeaveConfirm(null)}
      />
    </div>
  );
}

// 0件（確定版 Final-11 の 20）：点線の吹き出し2つ、写真家ラビット、［グループを作る］［コードで参加］
function GroupEmpty({ onCreate, onJoin }) {
  const rabbit = chara('VNGL');
  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 40, right: 40, top: 18, zIndex: 2 }}>
        <div style={{ width: 190, height: 40, boxSizing: 'border-box', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: 20 }} />
        <div style={{ width: 150, height: 40, boxSizing: 'border-box', margin: '10px 0 0 auto', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: 20 }} />
      </div>
      <div style={{ padding: '118px 28px 130px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <img src={rabbit?.framed} alt="" style={{ display: 'block', width: 140, height: 214, objectFit: 'contain', objectPosition: 'center bottom' }} />
        <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 19, lineHeight: 1.55 }}>
          友達とグループを作ると、
          <br />
          みんなが行きたいお店が
          <br />
          見つかります
        </p>
        <div style={{ width: '100%', marginTop: 24 }}>
          <Button variant="primary" onClick={onCreate}>
            グループを作る
          </Button>
          <Button variant="secondary" onClick={onJoin} style={{ marginTop: 10 }}>
            コードで参加
          </Button>
        </div>
      </div>
    </div>
  );
}

// 下に固定のボタン（左右20・下34）
function BottomAction({ children }) {
  return <div style={{ position: 'absolute', left: 20, right: 20, bottom: 34, zIndex: 6 }}>{children}</div>;
}

// 作る・招待・コードで参加は、下のタブを出さない画面（確定版 Final-11 の 5・6・11・12）
function FullScreen({ children }) {
  return (
    <div className="ui-sub-enter" style={{ position: 'fixed', inset: 0, zIndex: 45, background: color.bg }}>
      {children}
    </div>
  );
}

// グループを作る（確定版 Final-11 の 5）
function CreateGroup({ onBack, onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const g = await createGroup({ userId: user.id, name: name.trim() });
      onCreated(g);
    } catch (err) {
      console.error('グループ作成エラー:', err?.message || err);
      setError('作れませんでした。少したってから、もう一度お試しください');
      setBusy(false);
    }
  };
  return (
    <form style={page} onSubmit={submit} noValidate>
      <SubHeader title="グループを作る" onBack={onBack} />
      <div style={{ padding: '16px 20px 0' }}>
        <TextField label="グループ名" value={name} onChange={(v) => setName(v.slice(0, GROUP_NAME_MAX))} maxLength={GROUP_NAME_MAX} showCount error={error} />
      </div>
      <BottomAction>
        <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
          作成する
        </Button>
      </BottomAction>
    </form>
  );
}

// IDで招待（画面ごとの仕様 ⑪）：@ハンドルを入れて探す→確認のカード→送る
function IdInviteTab({ group }) {
  const toast = useToast();
  const [handle, setHandle] = useState('');
  const [found, setFound] = useState(null); // null | 'notFound' | {id, handle, display_name, avatar_path, mogu_type_code}
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    if (!handle.trim() || busy) return;
    setBusy(true);
    setSent(false);
    try {
      const r = await findUserByHandle(handle.trim());
      setFound(r || 'notFound');
    } catch {
      setFound('notFound');
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!found || found === 'notFound') return;
    setBusy(true);
    const res = await inviteByHandle(group.id, found.handle);
    setBusy(false);
    if (res.error) {
      toast?.show(res.error === 'alreadyMember' ? 'すでにこのグループのメンバーです' : '送れませんでした。少したってから、もう一度お試しください');
      return;
    }
    setSent(true);
    toast?.show('招待を送りました');
  };

  const type = found && found !== 'notFound' ? getType(found.mogu_type_code) : null;

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <form onSubmit={search}>
        <TextField label="ユーザーID" prefix="@" value={handle} onChange={(v) => setHandle(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))} autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={!handle.trim() || busy} style={{ marginTop: 14 }}>
          探す
        </Button>
      </form>
      {found === 'notFound' && (
        <p role="alert" style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.6, color: color.sub, textAlign: 'center' }}>
          @{handle} さんは見つかりませんでした
        </p>
      )}
      {found && found !== 'notFound' && (
        <div style={{ marginTop: 20, padding: 16, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={52} name={found.display_name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{found.display_name}</div>
            <div style={{ fontSize: 12, color: color.sub }}>@{found.handle}</div>
          </div>
          {type && <span style={{ fontSize: 12, fontWeight: 700, color: color.ink }}>{type.name}</span>}
        </div>
      )}
      {found && found !== 'notFound' && (
        <Button variant="primary" onClick={send} disabled={busy || sent} style={{ marginTop: 16 }}>
          {sent ? '招待を送りました' : '招待を送る'}
        </Button>
      )}
    </div>
  );
}

// QRコードのポスター（画面ごとの仕様 ⑪。確定版の見本は未確認のため、仕様の文章どおりに組んだ暫定デザイン）
function QrInviteTab({ group, invite }) {
  const [posterUrl, setPosterUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!invite) return;
    let alive = true;
    buildInvitePosterDataUrl({ qrText: invite.link, groupName: group.name, code: invite.code })
      .then((url) => alive && setPosterUrl(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [invite, group.name]);

  const save = async () => {
    if (!posterUrl || saving) return;
    setSaving(true);
    try {
      await saveImageDataUrl(posterUrl, `mogu-${group.name}-invite.png`);
      toast?.show('画像を保存しました');
    } catch {
      toast?.show('保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 24, overflow: 'hidden', border: `${stroke.shape}px solid ${color.ink}`, background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {posterUrl ? <img src={posterUrl} alt={`${group.name}のQRコード`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Icon name="qr" size={40} color={color.sub} />}
      </div>
      <Button variant="primary" onClick={save} disabled={!posterUrl || saving} style={{ marginTop: 18 }}>
        画像を保存
      </Button>
    </div>
  );
}

// 招待する（確定版 Final-11 の 6・11）：LINEなどで送る＋招待コード／QRコード／IDで招待
function InviteGroup({ group, onBack }) {
  const toast = useToast();
  const [tab, setTab] = useState('code'); // code | qr | id
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    createInvite(group.id)
      .then((v) => alive && setInvite(v))
      .catch((err) => {
        console.error('招待作成エラー:', err?.message || err);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [group.id]);

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      toast?.show('招待コードをコピーしました');
    } catch {
      /* コピーできない端末 */
    }
  };
  const send = () => invite && shareText({ title: `${group.name}への招待`, text: `mogu のグループ「${group.name}」に参加しよう。招待コード：${invite.code}`, url: invite.link });

  const tabBtn = (key, label) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      style={{ flex: '1 1 0px', height: 44, padding: 0, border: 0, borderBottom: `3px solid ${tab === key ? color.ink : 'transparent'}`, background: 'transparent', color: tab === key ? color.ink : color.sub, fontFamily: tab === key ? font.dela : 'inherit', fontSize: 14, fontWeight: tab === key ? 400 : 700 }}
    >
      {label}
    </button>
  );

  return (
    <div style={page}>
      <header style={{ flex: 'none', paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ position: 'relative', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            aria-label="戻る"
            onClick={onBack}
            className="ui-btn ui-btn--text"
            style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" size={24} />
          </button>
          <h1 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400, whiteSpace: 'nowrap' }}>招待する</h1>
          <button
            type="button"
            onClick={onBack}
            className="ui-btn ui-btn--text"
            style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
          >
            完了
          </button>
        </div>
      </header>
      <div role="tablist" style={{ flex: 'none', display: 'flex', padding: '0 20px', borderBottom: `1px solid ${color.line}` }}>
        {tabBtn('code', 'コード')}
        {tabBtn('qr', 'QRコード')}
        {tabBtn('id', 'IDで招待')}
      </div>
      <div style={body}>
        {tab === 'code' && (
          <div style={{ padding: '20px 20px 40px' }}>
            <p style={{ margin: 0, fontFamily: font.dela, fontSize: 22, lineHeight: 1.35 }}>
              {group.name}に
              <br />
              友達を呼ぼう
            </p>
            {canShare() && (
              <button
                type="button"
                onClick={send}
                disabled={!invite}
                className="ui-btn ui-btn--primary"
                style={{
                  width: '100%',
                  height: 56,
                  marginTop: 18,
                  border: 0,
                  borderRadius: 28,
                  background: invite ? color.ink : color.surface,
                  color: invite ? color.white : color.sub,
                  fontFamily: 'inherit',
                  fontSize: 16,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon name="share" size={20} />
                LINE などで送る
              </button>
            )}
            <div style={{ marginTop: 22, padding: 16, borderRadius: 24, background: color.surface }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>招待コード</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontFamily: font.dela, fontSize: 22, letterSpacing: '0.08em', minHeight: 30 }}>{invite ? invite.code : error ? '' : '…'}</span>
                  <button
                    type="button"
                    onClick={copy}
                    disabled={!invite}
                    className="ui-btn ui-btn--small"
                    style={{
                      flex: 'none',
                      height: 44,
                      padding: '0 14px',
                      boxSizing: 'border-box',
                      border: `${stroke.shape}px solid ${color.ink}`,
                      borderRadius: 22,
                      background: color.white,
                      color: color.ink,
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Icon name="copy" size={18} />
                    コピー
                  </button>
                </div>
                {error && (
                  <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>
                    招待コードを作れませんでした。少したってから、もう一度お試しください
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {tab === 'qr' && <QrInviteTab group={group} invite={invite} />}
        {tab === 'id' && <IdInviteTab group={group} />}
      </div>
    </div>
  );
}

// コードで参加（確定版 Final-11 の 11・12）
function JoinGroup({ onBack, onJoined, initialCode }) {
  const { user } = useAuth();
  const [code, setCode] = useState(initialCode || '');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const messages = {
    notFound: '招待コードが見つかりません',
    expired: 'この招待コードは期限が切れています',
    guest: 'グループは、アカウントを登録すると使えます',
    failed: '参加できませんでした。少したってから、もう一度お試しください',
  };

  // QRスキャン・ディープリンクから来たコードは、そのまま確認まで進める（§7-6「グループを確かめる」）
  useEffect(() => {
    if (!initialCode || autoRan) return;
    Promise.resolve()
      .then(() => {
        setAutoRan(true);
        return previewInvite(initialCode);
      })
      .then((p) => {
        if (p?.notFound) {
          setError(messages.notFound);
          return;
        }
        if (p) {
          setPreview(p);
          return;
        }
        return joinByCode(initialCode, user.id).then((res) => {
          if (res.error) {
            setError(messages[res.error] || messages.failed);
            return;
          }
          onJoined(res);
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, autoRan]);

  const join = async () => {
    setBusy(true);
    setError('');
    const res = await joinByCode(code, user.id);
    setBusy(false);
    if (res.error) {
      setPreview(null);
      setError(messages[res.error] || messages.failed);
      return;
    }
    onJoined(res);
  };

  const next = async (e) => {
    e?.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const p = await previewInvite(code);
      setBusy(false);
      if (p?.notFound) {
        setError(messages.notFound);
        return;
      }
      if (p) {
        setPreview(p);
        return;
      }
    } catch {
      setBusy(false);
    }
    // 確認の関数がまだないDB：そのまま参加する
    join();
  };

  if (preview) {
    return (
      <div style={page}>
        <SubHeader title="コードで参加" onBack={() => setPreview(null)} />
        <div style={body}>
          <div style={{ padding: '16px 20px 260px' }}>
            <div style={{ padding: 20, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 32 }}>
              <div style={{ display: 'flex' }}>
                <GroupAvatar members={preview.members} size={64} />
              </div>
              <h2 className="no-zoom" style={{ margin: '14px 0 0', fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.25 }}>
                {preview.name}
              </h2>
              {preview.count != null && <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: color.sub }}>{preview.count}人</div>}
              {preview.members.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  {preview.members.map((m, i) => (
                    <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 64 }}>
                      <Avatar size={52} name={m.display_name} />
                      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <BottomAction>
          <Button variant="primary" onClick={join} disabled={busy}>
            参加する
          </Button>
          <Button variant="secondary" onClick={onBack} style={{ marginTop: 10 }}>
            やめる
          </Button>
        </BottomAction>
      </div>
    );
  }

  return (
    <form style={page} onSubmit={next} noValidate>
      <SubHeader title="コードで参加" onBack={onBack} />
      <div style={{ padding: 20, paddingTop: 16 }}>
        <TextField
          label="招待コード"
          value={code}
          onChange={(v) => {
            setCode(v);
            setError('');
          }}
          error={error}
        />
        <Button type="submit" variant="primary" disabled={!code.trim() || busy} style={{ marginTop: 20 }}>
          次へ
        </Button>
      </div>
    </form>
  );
}

// グループの通報（確定版 Final-13 の 10・f13-10）。2回目：submit_report（kind='group'）へ送る
const REPORT_REASONS = [
  { id: 'group_name', label: '不適切なグループ名' },
  { id: 'harassment', label: 'グループでのいやがらせ' },
  { id: 'other', label: 'その他' },
];
function ReportGroupSheet({ group, onClose, onSent }) {
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <BottomSheet open onClose={onSent} ariaLabel="送信しました" minHeight={230}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
          <span style={{ display: 'flex', width: 64, height: 64, borderRadius: '50%', background: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={color.white} />
          </span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>送信しました</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>内容を確認して対応します</p>
        <Button variant="secondary" onClick={onSent} style={{ marginTop: 22 }}>
          閉じる
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} ariaLabel="このグループを通報する">
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: font.dela, fontSize: 18 }}>このグループを通報する</div>
        <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{group.name}</div>
      </div>
      <p style={{ margin: '14px 0 10px', fontSize: 13, fontWeight: 700, color: color.sub }}>あてはまるものを1つ選んでください</p>
      <div role="radiogroup" aria-label="通報の理由" style={{ borderBottom: `1px solid ${color.line}` }}>
        {REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            style={{
              width: '100%',
              minHeight: 56,
              padding: '0 2px',
              border: 0,
              borderTop: `1px solid ${color.line}`,
              background: 'transparent',
              color: color.ink,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ flex: '1 1 0%', textAlign: 'left', fontSize: 16, fontWeight: reason === r.id ? 700 : 500 }}>{r.label}</span>
            <Radio on={reason === r.id} />
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      <Button
        variant="primary"
        disabled={busy || !reason}
        onClick={async () => {
          setBusy(true);
          setError('');
          const res = await submitReport({ kind: 'group', reason, targetGroup: group.id });
          setBusy(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          setSent(true);
        }}
        style={{ marginTop: 20 }}
      >
        送信する
      </Button>
    </BottomSheet>
  );
}

// グループの詳細（確定版 Final-11 の 16〜19 の「メンバー」「設定」）
// お店タブ「流れ」：まだ見ていないお店を1件ずつ。いいね／パス（画面ごとの仕様 ⑪）
//   確定版の見本は未確認のため、スワイプではなくボタンでの暫定操作（ハート＝いいね、パス＝見るだけ送る）
function GroupFlowCard({ shop, onLike, onPass, busy }) {
  const photos = shopPhotos(shop);
  const budget = budgetLabel(shop.price_level);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', borderRadius: 32, overflow: 'hidden', border: `${stroke.shape}px solid ${color.ink}`, background: color.ink }}>
        {photos[0] && <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(46,44,42,0) 40%, rgba(46,44,42,0.88) 100%)' }} />
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, color: color.white }}>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400 }}>{shop.name}</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: color.line }}>{[shop.area, genreLabel(shop), budget].filter(Boolean).join('・')}</div>
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 20 }}>
        <button type="button" aria-label="見るだけ（パス）" onClick={onPass} disabled={busy} className="ui-btn ui-press" style={{ width: 60, height: 60, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="undo" size={26} />
        </button>
        <button type="button" aria-label="いいね" onClick={onLike} disabled={busy} className="ui-btn ui-press" style={{ width: 60, height: 60, borderRadius: '50%', border: 0, background: color.ink, color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heartFill" size={26} color={color.white} />
        </button>
      </div>
    </div>
  );
}

// ボード：♡の多い順。だれが♡したかは出さない（画面ごとの仕様 ⑪）
function GroupBoardGrid({ group, onOpenShop }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  const load = useCallback(() => groupBoardFull(group.id).then(setRows).catch(() => setRows([])), [group.id]);
  useEffect(() => {
    load();
  }, [load]);

  const toggleHeart = async (row) => {
    setBusyId(row.restaurant_id);
    try {
      const r = await groupToggleHeart(group.id, row.restaurant_id);
      setRows((list) => (list || []).map((x) => (x.restaurant_id === row.restaurant_id ? { ...x, like_count: r.like_count, my_heart: r.my_heart } : x)));
      if (r.matched) toast?.show('マッチしました！');
    } catch {
      toast?.show('通信に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  if (rows == null) return <LoadingState style={{ paddingTop: 60 }} />;
  if (rows.length === 0) {
    return <p style={{ margin: '40px 0 0', textAlign: 'center', fontSize: 13, color: color.sub, lineHeight: 1.7 }}>まだお店がありません。<br />ホームでいいねするか、お店の詳細から「グループに送る」で追加できます</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {rows.map((row, i) => {
        const photo = shopPhotos(row.shop)[0];
        const first = i === 0;
        return (
          <div key={row.restaurant_id} style={{ gridColumn: first ? 'span 2' : 'span 1', gridRow: first ? 'span 2' : 'span 1', position: 'relative', aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', border: `${stroke.shape}px solid ${color.ink}`, background: color.surface }}>
            <button type="button" onClick={() => onOpenShop?.(row.shop)} className="ui-btn ui-press" style={{ position: 'absolute', inset: 0, border: 0, padding: 0, background: 'transparent' }}>
              {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            </button>
            {first && (
              <span style={{ position: 'absolute', left: 8, top: 8, width: 26, height: 26, borderRadius: '50%', background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
            )}
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'linear-gradient(180deg, rgba(46,44,42,0) 0%, rgba(46,44,42,0.75) 100%)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: color.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.shop.name}</span>
              <button
                type="button"
                aria-label={row.my_heart ? 'いいねを外す' : 'いいね'}
                onClick={() => toggleHeart(row)}
                disabled={busyId === row.restaurant_id}
                className="ui-btn"
                style={{ flex: 'none', border: 0, background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 2, color: color.white }}
              >
                <Icon name={row.my_heart ? 'heartFill' : 'heartCheck'} size={14} color={row.my_heart ? color.red : color.white} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>{row.like_count}</span>
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// お店タブ：流れ（まだ見ていないお店）→ ボード
function GroupShopTab({ group, onOpenShop }) {
  const [flow, setFlow] = useState(null); // null(読み込み中) | 配列
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // null | { seen, liked }
  const [boardKey, setBoardKey] = useState(0);

  useEffect(() => {
    let alive = true;
    groupUnseenShopsFull(group.id)
      .then((rows) => alive && setFlow(rows))
      .catch(() => alive && setFlow([]));
    return () => {
      alive = false;
    };
  }, [group.id]);

  const advance = (liked) => {
    setDone((d) => ({ seen: (d?.seen || 0) + 1, liked: (d?.liked || 0) + (liked ? 1 : 0) }));
    setIndex((i) => i + 1);
  };

  const pass = async (row) => {
    setBusy(true);
    try {
      await groupMarkSeen(group.id, row.restaurant_id);
      advance(false);
    } finally {
      setBusy(false);
    }
  };
  const like = async (row) => {
    setBusy(true);
    try {
      await groupToggleHeart(group.id, row.restaurant_id);
      advance(true);
    } finally {
      setBusy(false);
    }
  };

  if (flow == null) return <LoadingState style={{ paddingTop: 60 }} />;

  if (flow.length > 0 && index < flow.length) {
    const row = flow[index];
    return (
      <div style={{ paddingTop: 10 }}>
        <p style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: color.sub }}>まだ見ていないお店（{flow.length - index}件）</p>
        <div style={{ paddingBottom: 90 }}>
          <GroupFlowCard shop={row.shop} onPass={() => pass(row)} onLike={() => like(row)} busy={busy} />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <p style={{ margin: 0, fontFamily: font.dela, fontSize: 24 }}>完了！</p>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7 }}>
          新しいお店{done.seen}件を見ました
          <br />
          {done.liked}件にいいね
        </p>
        <Button
          variant="primary"
          onClick={() => {
            setDone(null);
            setBoardKey((k) => k + 1);
          }}
          style={{ marginTop: 22, width: 200 }}
        >
          ボードを見る
        </Button>
      </div>
    );
  }

  return <GroupBoardGrid key={boardKey} group={group} onOpenShop={onOpenShop} />;
}

function GroupDetail({ group, inUse, onBack, onToggleUse, onInvite, onLeft, onOpenShop, initialTab }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab === 'shop' ? 'shop' : 'members');
  const [members, setMembers] = useState(group.members || []);
  const [report, setReport] = useState(false);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewProfile, setViewProfile] = useState(null); // メンバーの行を押したとき開く他の人のプロフィール（userId）
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [displayName, setDisplayName] = useState(group.name);
  const [pinned, setPinned] = useState(!!group.pinned);
  const [muted, setMuted] = useState(!!group.muted);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    groupMembers(group.id)
      .then((m) => alive && setMembers(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [group.id]);

  const doLeave = async () => {
    setBusy(true);
    try {
      await leaveGroup({ groupId: group.id, userId: user.id });
      setLeave(false);
      onLeft(group);
    } catch (err) {
      console.error('退出エラー:', err?.message || err);
    } finally {
      setBusy(false);
    }
  };

  const doRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === displayName) {
      setRenaming(false);
      return;
    }
    try {
      await renameGroup(group.id, trimmed);
      setDisplayName(trimmed); // 一覧に戻ったときの再取得まで、ここでも見た目を合わせる
      setRenaming(false);
      toast?.show('グループ名を変えました');
    } catch {
      toast?.show('変えられませんでした。少したってから、もう一度お試しください');
    }
  };
  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    try {
      await setGroupPinned(group.id, next);
    } catch {
      setPinned(!next);
    }
  };
  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try {
      await setGroupMuted(group.id, next);
    } catch {
      setMuted(!next);
    }
  };

  const tabBtn = (key, label) => {
    const on = tab === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => setTab(key)}
        style={{
          flex: '1 1 0px',
          height: 48,
          padding: 0,
          border: 0,
          borderBottom: `4px solid ${on ? color.ink : 'transparent'}`,
          background: 'transparent',
          color: on ? color.ink : color.sub,
          fontFamily: on ? font.dela : 'inherit',
          fontSize: 15,
          fontWeight: on ? 400 : 700,
        }}
      >
        {label}
      </button>
    );
  };
  const setRow = (icon, label, onClick, danger) => (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-btn--text"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: 0,
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: 'transparent',
        color: danger ? color.red : color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={22} color={danger ? color.red : color.ink} />
      <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{label}</span>
    </button>
  );

  return (
    <div style={page}>
      <SubHeader title="" onBack={onBack} />
      <div style={body}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>
          <GroupAvatar members={members} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.dela, fontSize: 21, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: color.sub }}>{members.length || group.count || ''}人</div>
          </div>
          <button
            type="button"
            aria-pressed={inUse}
            onClick={onToggleUse}
            className="ui-btn ui-btn--small"
            style={{
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 36,
              padding: '0 12px',
              boxSizing: 'border-box',
              border: `${stroke.shape}px solid ${color.ink}`,
              borderRadius: 18,
              background: inUse ? color.surface : color.white,
              color: color.ink,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {inUse && <Icon name="check" size={16} />}
            {inUse ? 'ホームで使用中' : 'ホームで使う'}
          </button>
        </div>
        <div role="tablist" style={{ display: 'flex', marginTop: 12, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
          {tabBtn('shop', 'お店')}
          {tabBtn('members', 'メンバー')}
          {tabBtn('settings', '設定')}
        </div>
        <div style={{ padding: '6px 20px 150px' }}>
          {tab === 'shop' && <GroupShopTab group={group} onOpenShop={onOpenShop} />}
          {tab === 'members' && (
            <>
              <button
                type="button"
                onClick={onInvite}
                className="ui-btn ui-btn--text"
                style={{
                  width: '100%',
                  height: 60,
                  padding: '0 4px',
                  border: 0,
                  borderBottom: `1px solid ${color.line}`,
                  background: 'transparent',
                  color: color.ink,
                  fontFamily: 'inherit',
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    boxSizing: 'border-box',
                    border: `${stroke.shape}px dashed ${color.ink}`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="plusLarge" size={22} />
                </span>
                友達を招待する
                <span style={{ marginLeft: 'auto', display: 'flex' }}>
                  <Icon name="chevronRightLarge" size={20} />
                </span>
              </button>
              {members.map((m, i) => {
                const t = getType(m.food_style);
                const g = t ? groupColor[groupOf(t.code)] : null;
                const self = m.id === user?.id;
                const row = (
                  <>
                    <Avatar size={44} name={m.display_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.display_name}
                        {self && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: color.sub }}>あなた</span>}
                      </div>
                    </div>
                    {t && (
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: font.dela, fontSize: 11, lineHeight: '15px', color: g ? g.dark : color.ink }}>{t.code}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, lineHeight: '17px', color: color.ink }}>{t.name}</span>
                      </span>
                    )}
                  </>
                );
                const rowStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === members.length - 1 ? 0 : `1px solid ${color.line}` };
                if (self) {
                  return <div key={m.id || i} style={rowStyle}>{row}</div>;
                }
                return (
                  <button key={m.id || i} type="button" onClick={() => setViewProfile(m.id)} className="ui-btn ui-btn--text" style={{ ...rowStyle, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}>
                    {row}
                  </button>
                );
              })}
            </>
          )}
          {tab === 'settings' && (
            <>
              {renaming ? (
                <div style={{ padding: '10px 0', borderBottom: `1px solid ${color.line}` }}>
                  <TextField label="グループ名" value={name} onChange={(v) => setName(v.slice(0, GROUP_NAME_MAX))} maxLength={GROUP_NAME_MAX} showCount />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Button variant="primary" onClick={doRename} style={{ flex: 1 }}>
                      変える
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setName(displayName);
                        setRenaming(false);
                      }}
                      style={{ flex: 1 }}
                    >
                      やめる
                    </Button>
                  </div>
                </div>
              ) : (
                setRow('pencil', 'グループ名を変える', () => setRenaming(true))
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, borderBottom: `1px solid ${color.line}` }}>
                <Icon name="pin" size={22} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>一覧の上にピン留め</span>
                <Switch on={pinned} onChange={togglePin} label="一覧の上にピン留め" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, borderBottom: `1px solid ${color.line}` }}>
                <Icon name="bellOff" size={22} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>このグループの通知をオフ</span>
                <Switch on={muted} onChange={toggleMute} label="このグループの通知をオフ" />
              </div>
              {setRow('flag', 'このグループを通報する', () => setReport(true))}
              {setRow('leave', 'グループから抜ける', () => setLeave(true), true)}
            </>
          )}
        </div>
      </div>
      {report && <ReportGroupSheet group={group} onClose={() => setReport(false)} onSent={() => setReport(false)} />}
      <ConfirmSheet open={leave} title="グループから抜けますか？" actionLabel="グループから抜ける" danger busy={busy} onConfirm={doLeave} onCancel={() => setLeave(false)} />
      {viewProfile && <OtherProfileScreen userId={viewProfile} onBack={() => setViewProfile(null)} />}
    </div>
  );
}

export default function GroupScreen({ selectedGroup, onSelectGroup, pendingCode, onConsumePendingCode, pendingOpenGroup, onConsumePendingOpenGroup, onOpenShop }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading');
  const [view, setView] = useState({ name: 'list' }); // list | create | join | detail | invite
  const [reloadKey, setReloadKey] = useState(0);
  const [permSheet, setPermSheet] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    listGroups(user.id)
      .then((g) => {
        if (!alive) return;
        setGroups(g);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('グループ取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [user?.id, reloadKey]);

  // お知らせの行・QRのスキャンから届く、開き先の指定（§7-6・§10）
  useEffect(() => {
    if (!pendingOpenGroup?.id) return;
    Promise.resolve().then(() => {
      setView({ name: 'detail', group: { id: pendingOpenGroup.id, name: '' }, initialTab: pendingOpenGroup.tab });
      onConsumePendingOpenGroup?.();
    });
  }, [pendingOpenGroup, onConsumePendingOpenGroup]);
  useEffect(() => {
    if (!pendingCode) return;
    Promise.resolve().then(() => {
      setView({ name: 'join', code: pendingCode });
      onConsumePendingCode?.();
    });
  }, [pendingCode, onConsumePendingCode]);

  const toList = () => setView({ name: 'list' });
  const afterJoined = () => {
    if (!hasSeenGroupJoinPrompt()) setPermSheet(true);
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

  if (view.name === 'create') {
    return (
      <FullScreen>
        <CreateGroup
          onBack={toList}
          onCreated={(g) => {
            reload();
            afterJoined();
            setView({ name: 'invite', group: g, back: { name: 'detail', group: g } });
          }}
        />
      </FullScreen>
    );
  }
  if (view.name === 'join') {
    return (
      <FullScreen>
        <JoinGroup
          initialCode={view.code}
          onBack={toList}
          onJoined={(res) => {
            reload();
            toList();
            afterJoined();
            toast?.show(res.name ? `${res.name}に参加しました` : 'グループに参加しました', { withTabBar: true });
          }}
        />
      </FullScreen>
    );
  }
  if (view.name === 'invite') {
    return (
      <FullScreen>
        <InviteGroup group={view.group} onBack={() => setView(view.back || { name: 'list' })} />
      </FullScreen>
    );
  }
  if (view.name === 'detail') {
    const g = groups.find((x) => x.id === view.group.id) || view.group;
    const inUse = selectedGroup?.id === g.id;
    return (
      <>
        <GroupDetail
          group={g}
          inUse={inUse}
          initialTab={view.initialTab}
          onBack={toList}
          onOpenShop={onOpenShop}
          onToggleUse={() => onSelectGroup?.(inUse ? null : { id: g.id, name: g.name, members: g.members, count: g.count })}
          onInvite={() => setView({ name: 'invite', group: g, back: { name: 'detail', group: g } })}
          onLeft={(left) => {
            if (selectedGroup?.id === left.id) onSelectGroup?.(null);
            setGroups((list) => list.filter((x) => x.id !== left.id));
            toList();
          }}
        />
        <NotificationPermissionSheet open={permSheet} onClose={dismissPush} onEnable={enablePush} />
      </>
    );
  }
  return (
    <>
      <GroupList
        groups={groups}
        status={status}
        selectedId={selectedGroup?.id}
        onRetry={() => {
          setStatus('loading');
          reload();
        }}
        onOpen={(g) => setView({ name: 'detail', group: g })}
        onCreate={() => setView({ name: 'create' })}
        onJoin={() => setView({ name: 'join' })}
        onTogglePin={async (g) => {
          try {
            await setGroupPinned(g.id, !g.pinned);
            reload();
          } catch {
            toast?.show('通信に失敗しました');
          }
        }}
        onToggleMute={async (g) => {
          try {
            await setGroupMuted(g.id, !g.muted);
            reload();
          } catch {
            toast?.show('通信に失敗しました');
          }
        }}
        onLeave={async (g) => {
          try {
            await leaveGroup({ groupId: g.id });
            if (selectedGroup?.id === g.id) onSelectGroup?.(null);
            setGroups((list) => list.filter((x) => x.id !== g.id));
          } catch {
            toast?.show('通信に失敗しました');
          }
        }}
      />
      <NotificationPermissionSheet open={permSheet} onClose={dismissPush} onEnable={enablePush} />
    </>
  );
}
