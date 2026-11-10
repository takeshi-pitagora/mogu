import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
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
import { LoadingState, ErrorState } from '../../components/ui/States';
import { chara } from '../../lib/chara';
import { getType } from '../../lib/mogutype';
import { canShare, shareText } from '../../lib/open';
import { shopPhotos, genreLabel } from '../../lib/shop';
import {
  createGroup,
  createInvite,
  fetchGroupBoard,
  fetchGroupFeed,
  groupMembers,
  inviteByHandle,
  joinByCode,
  leaveGroup,
  listGroups,
  previewInvite,
  renameGroup,
  setGroupMuted,
  setGroupPinned,
  toggleGroupHeart,
} from '../../lib/groups';
import { submitReport } from '../../lib/profile';
import OtherProfileScreen from '../profile/OtherProfileScreen';
import { SubHeader } from '../settings/SettingsParts';

// グループ（確定版 Final-11・3回目 §7-5）
//   一覧：検索・ピン留め（先頭）・未読の件数・最新の出来事。＋から作る／コードで参加
//   招待：LINEなどで送る・招待コード・QRコード・IDで招待
//   詳細：お店（新着・ボード）／メンバー／設定（ミュート・名前の変更・通報・抜ける）
const GROUP_NAME_MAX = 20;
const LONG_PRESS_MS = 480;

const page = { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink };
const body = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' };

// 一覧の行（確定版 Final-11 の 1）。ピン留め・未読の数・最新の出来事・長押しでメニュー
function GroupRow({ g, inUse, onOpen, onLongPress }) {
  const names = (g.members || []).map((m) => m.display_name).filter(Boolean);
  const timer = useRef(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress?.();
    }, LONG_PRESS_MS);
  };
  const clear = () => timer.current && clearTimeout(timer.current);

  return (
    <button
      type="button"
      onClick={() => {
        if (fired.current) return;
        onOpen();
      }}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
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
        position: 'relative',
      }}
    >
      <GroupAvatar members={g.members} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          {g.pinned && <Icon name="pin" size={14} color={color.sub} style={{ marginRight: 4 }} />}
          <span style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
          {g.count != null && <span style={{ marginLeft: 4, fontSize: 13, color: color.sub }}>（{g.count}）</span>}
          {inUse && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, fontSize: 11, fontWeight: 700, color: color.ink }}>
              <Icon name="check" size={13} />
              使用中
            </span>
          )}
        </div>
        {g.lastEvent ? (
          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.lastEvent}</div>
        ) : names.length > 0 ? (
          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>メンバー：{names.join('・')}</div>
        ) : null}
      </div>
      {g.unseenCount > 0 && (
        <span aria-label={`未読${g.unseenCount}件`} style={{ flex: 'none', minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box', borderRadius: 11, background: color.red, color: color.white, fontFamily: font.plex, fontSize: 12, fontWeight: 700, lineHeight: '22px', textAlign: 'center' }}>
          {g.unseenCount > 99 ? '99+' : g.unseenCount}
        </span>
      )}
    </button>
  );
}

// 長押しのメニュー（ピン留め・ミュート）
function RowMenu({ g, onClose, onTogglePin, onToggleMute }) {
  const item = (icon, label, onClick, last) => (
    <button
      type="button"
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
    <BottomSheet open onClose={onClose} ariaLabel={`${g.name}のメニュー`} minHeight={120} padding="10px 0 24px">
      <div style={{ padding: '2px 20px 8px', fontSize: 13, fontWeight: 700, color: color.sub }}>{g.name}</div>
      {item('pin', g.pinned ? 'ピン留めを外す' : 'ピン留めする', () => onTogglePin(!g.pinned))}
      {item(g.muted ? 'bell' : 'bellOff', g.muted ? '通知をオンにする' : '通知をオフにする（ミュート）', () => onToggleMute(!g.muted), true)}
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

function GroupList({ groups, status, selectedId, onRetry, onOpen, onCreate, onJoin, onTogglePin, onToggleMute }) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => [g.name, ...(g.members || []).map((m) => m.display_name)].filter(Boolean).some((t) => String(t).toLowerCase().includes(q)));
  }, [groups, query]);
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
              {visible.map((g) => (
                <GroupRow key={g.id} g={g} inUse={selectedId === g.id} onOpen={() => onOpen(g)} onLongPress={() => setRowMenu(g)} />
              ))}
            </div>
          )}
        </div>
      )}
      {rowMenu && (
        <RowMenu
          g={rowMenu}
          onClose={() => setRowMenu(null)}
          onTogglePin={(v) => {
            setRowMenu(null);
            onTogglePin(rowMenu, v);
          }}
          onToggleMute={(v) => {
            setRowMenu(null);
            onToggleMute(rowMenu, v);
          }}
        />
      )}
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

// 招待する（確定版 Final-11 の 6）：リンク／QRコード／IDで招待 の3つを切り替える
const INVITE_TABS = [
  { key: 'link', label: 'リンク' },
  { key: 'qr', label: 'QRコード' },
  { key: 'handle', label: 'IDで招待' },
];
function InviteGroup({ group, onBack }) {
  const toast = useToast();
  const [tab, setTab] = useState('link');
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [handle, setHandle] = useState('');
  const [handleBusy, setHandleBusy] = useState(false);
  const [handleMsg, setHandleMsg] = useState('');

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

  useEffect(() => {
    if (!invite?.link || tab !== 'qr') return;
    QRCode.toDataURL(invite.link, { width: 220, margin: 1, color: { dark: '#2E2C2A', light: '#FFFFFF' } })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [invite?.link, tab]);

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

  const sendByHandle = async (e) => {
    e?.preventDefault();
    if (!handle.trim() || handleBusy) return;
    setHandleBusy(true);
    setHandleMsg('');
    const res = await inviteByHandle(group.id, handle.trim());
    setHandleBusy(false);
    if (res.error) {
      setHandleMsg('そのIDの人を招待できませんでした');
      return;
    }
    setHandle('');
    setHandleMsg('招待を送りました');
  };

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
      <div role="tablist" style={{ flex: 'none', display: 'flex', margin: '0 20px', borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
        {INVITE_TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              style={{ flex: '1 1 0px', height: 44, padding: 0, border: 0, borderBottom: `3px solid ${on ? color.ink : 'transparent'}`, background: 'transparent', color: on ? color.ink : color.sub, fontFamily: on ? font.dela : 'inherit', fontSize: 14, fontWeight: on ? 400 : 700 }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={body}>
        <div style={{ padding: '18px 20px 40px' }}>
          <p style={{ margin: 0, fontFamily: font.dela, fontSize: 22, lineHeight: 1.35 }}>
            {group.name}に
            <br />
            友達を呼ぼう
          </p>

          {tab === 'link' && (
            <>
              {canShare() && (
                <button
                  type="button"
                  onClick={send}
                  disabled={!invite}
                  className="ui-btn ui-btn--primary"
                  style={{ width: '100%', height: 56, marginTop: 18, border: 0, borderRadius: 28, background: invite ? color.ink : color.surface, color: invite ? color.white : color.sub, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
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
                      style={{ flex: 'none', height: 44, padding: '0 14px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
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
            </>
          )}

          {tab === 'qr' && (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 240, height: 240, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {qrUrl ? <img src={qrUrl} alt={`${group.name}への招待QRコード`} style={{ width: 220, height: 220, display: 'block' }} /> : <Icon name="qr" size={40} color={color.sub} />}
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13, color: color.sub, textAlign: 'center' }}>このQRコードを友達に読み取ってもらうと、グループに参加できます</p>
            </div>
          )}

          {tab === 'handle' && (
            <form onSubmit={sendByHandle} style={{ marginTop: 18 }}>
              <TextField label="友達のID" value={handle} onChange={(v) => { setHandle(v); setHandleMsg(''); }} placeholder="@から始まるID" />
              {handleMsg && (
                <p role="status" style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: handleMsg.includes('できません') ? color.red : color.ink }}>
                  {handleMsg}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={!handle.trim() || handleBusy} style={{ marginTop: 16 }}>
                招待を送る
              </Button>
              <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.6, color: color.sub }}>相手の「招待を受け取る範囲」の設定によっては、招待できないことがあります</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// コードで参加（確定版 Final-11 の 11・12）
function JoinGroup({ onBack, onJoined }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const messages = {
    notFound: '招待コードが見つかりません',
    expired: 'この招待コードは期限が切れています',
    guest: 'グループは、アカウントを登録すると使えます',
    failed: '参加できませんでした。少したってから、もう一度お試しください',
  };

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

// グループの通報（確定版 Final-13 の 10・f13-10）
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

// グループ名の変更（確定版 Final-11・設定タブから）
function RenameSheet({ group, onClose, onRenamed }) {
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await renameGroup(group.id, name.trim());
      onRenamed(name.trim());
    } catch (err) {
      console.error('グループ名の変更エラー:', err?.message || err);
      setError('変更できませんでした。少したってから、もう一度お試しください');
      setBusy(false);
    }
  };
  return (
    <BottomSheet open onClose={onClose} ariaLabel="グループ名を変更する" minHeight={260}>
      <div style={{ marginTop: 12, fontFamily: font.dela, fontSize: 18, textAlign: 'center' }}>グループ名を変更する</div>
      <div style={{ marginTop: 16 }}>
        <TextField label="グループ名" value={name} onChange={(v) => setName(v.slice(0, GROUP_NAME_MAX))} maxLength={GROUP_NAME_MAX} showCount error={error} />
      </div>
      <Button variant="primary" onClick={submit} disabled={!name.trim() || busy} style={{ marginTop: 16 }}>
        変更する
      </Button>
    </BottomSheet>
  );
}

// お店のカード（グループの「新着」「ボード」で共通）
function ShopRow({ s, onHeart, busy }) {
  const photo = shopPhotos(s)[0];
  const place = [s.area, s.genre || genreLabel(s)].filter(Boolean).join('・');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${color.line}` }}>
      <div style={{ flex: 'none', width: 56, height: 56, borderRadius: 16, overflow: 'hidden', background: color.ink }}>
        {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
        {place && <div style={{ marginTop: 2, fontSize: 12, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place}</div>}
      </div>
      {s.matched_at && (
        <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: color.ink, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Icon name="check" size={13} />
          マッチ
        </span>
      )}
      {s.heart_count != null && (
        <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: color.sub, minWidth: 18, textAlign: 'center' }}>{s.heart_count}</span>
      )}
      <button
        type="button"
        aria-pressed={s.self_hearted}
        disabled={busy}
        onClick={() => onHeart(s)}
        className="ui-btn ui-press"
        style={{ flex: 'none', width: 40, height: 40, border: 0, padding: 0, background: 'transparent', color: s.self_hearted ? color.red : color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={s.self_hearted ? 'heartFill' : 'heartCheck'} size={22} />
      </button>
    </div>
  );
}

function GroupShops({ groupId }) {
  const [feed, setFeed] = useState([]);
  const [board, setBoard] = useState([]);
  const [status, setStatus] = useState('loading');
  const [heartBusy, setHeartBusy] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchGroupFeed(groupId), fetchGroupBoard(groupId)])
      .then(([f, b]) => {
        if (!alive) return;
        setFeed(f);
        setBoard(b);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('グループのお店の取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [groupId, reloadKey]);

  const toggleHeart = async (s) => {
    setHeartBusy(s.restaurant_id);
    try {
      await toggleGroupHeart(groupId, s.restaurant_id);
      // 読み込み中の表示には戻さず、そのまま静かに読み直す
      const [f, b] = await Promise.all([fetchGroupFeed(groupId), fetchGroupBoard(groupId)]);
      setFeed(f);
      setBoard(b);
    } catch (err) {
      console.error('♡の切り替えエラー:', err?.message || err);
    } finally {
      setHeartBusy(null);
    }
  };

  if (status === 'loading') return <LoadingState style={{ paddingTop: 60 }} />;
  if (status === 'error') return <ErrorState kind="server" onRetry={reload} style={{ paddingTop: 60 }} />;

  return (
    <div style={{ padding: '6px 0 150px' }}>
      {feed.length > 0 && (
        <>
          <h3 style={{ margin: '10px 0 0', fontFamily: font.dela, fontSize: 15, fontWeight: 400 }}>新着</h3>
          {feed.map((s) => (
            <ShopRow key={s.restaurant_id} s={{ ...s, self_hearted: false }} onHeart={toggleHeart} busy={heartBusy === s.restaurant_id} />
          ))}
        </>
      )}
      <h3 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 15, fontWeight: 400 }}>ボード（♡の多い順）</h3>
      {board.length === 0 ? (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: color.sub }}>まだお店がありません。ホームでいいねすると、ここに並びます</p>
      ) : (
        board.map((s) => <ShopRow key={s.restaurant_id} s={s} onHeart={toggleHeart} busy={heartBusy === s.restaurant_id} />)
      )}
    </div>
  );
}

// グループの詳細（確定版 Final-11 の 16〜19）：お店／メンバー／設定
function GroupDetail({ group, inUse, onBack, onToggleUse, onInvite, onLeft, onRenamed }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('shops');
  const [members, setMembers] = useState(group.members || []);
  const [report, setReport] = useState(false);
  const [leave, setLeave] = useState(false);
  const [rename, setRename] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(!!group.muted);
  const [viewProfile, setViewProfile] = useState(null);

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

  const toggleMute = async (v) => {
    setMuted(v);
    try {
      await setGroupMuted(group.id, v);
    } catch (err) {
      console.error('ミュートの変更エラー:', err?.message || err);
      setMuted(!v);
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
  const setRow = (icon, label, onClick, danger, value) => (
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
      {value}
    </button>
  );

  return (
    <div style={page}>
      <SubHeader title="" onBack={onBack} />
      <div style={body}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>
          <GroupAvatar members={members} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.dela, fontSize: 21, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</div>
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
          {tabBtn('shops', 'お店')}
          {tabBtn('members', 'メンバー')}
          {tabBtn('settings', '設定')}
        </div>
        <div style={{ padding: '6px 20px 150px' }}>
          {tab === 'shops' && <GroupShops groupId={group.id} />}
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
              <button
                type="button"
                role="switch"
                aria-checked={muted}
                onClick={() => toggleMute(!muted)}
                className="ui-btn ui-btn--text"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: 0, border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
              >
                <Icon name={muted ? 'bellOff' : 'bell'} size={22} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>このグループをミュート</span>
                <span aria-hidden="true" style={{ position: 'relative', width: 46, height: 28, borderRadius: 14, background: muted ? color.ink : color.surface, boxSizing: 'border-box', border: `1px solid ${muted ? color.ink : color.lineStrong}` }}>
                  <span style={{ position: 'absolute', top: 2, left: muted ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: color.white }} />
                </span>
              </button>
              {setRow('pencil', 'グループ名を変更する', () => setRename(true))}
              {setRow('flag', 'このグループを通報する', () => setReport(true))}
              {setRow('leave', 'グループから抜ける', () => setLeave(true), true)}
            </>
          )}
        </div>
      </div>
      {report && <ReportGroupSheet group={group} onClose={() => setReport(false)} onSent={() => setReport(false)} />}
      {rename && <RenameSheet group={group} onClose={() => setRename(false)} onRenamed={(name) => { setRename(false); onRenamed(name); }} />}
      <ConfirmSheet open={leave} title="グループから抜けますか？" actionLabel="グループから抜ける" danger busy={busy} onConfirm={doLeave} onCancel={() => setLeave(false)} />
      {viewProfile && <OtherProfileScreen userId={viewProfile} onBack={() => setViewProfile(null)} />}
    </div>
  );
}

export default function GroupScreen({ selectedGroup, onSelectGroup, reloadSignal = 0 }) {
  const { user } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading');
  const [view, setView] = useState({ name: 'list' }); // list | create | join | detail | invite
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [user?.id, reloadKey, reloadSignal]);

  const toList = () => setView({ name: 'list' });

  const togglePin = async (g, v) => {
    setGroups((list) => list.map((x) => (x.id === g.id ? { ...x, pinned: v } : x)));
    try {
      await setGroupPinned(g.id, v);
      reload();
    } catch (err) {
      console.error('ピン留めの変更エラー:', err?.message || err);
      reload();
    }
  };
  const toggleMute = async (g, v) => {
    setGroups((list) => list.map((x) => (x.id === g.id ? { ...x, muted: v } : x)));
    try {
      await setGroupMuted(g.id, v);
    } catch (err) {
      console.error('ミュートの変更エラー:', err?.message || err);
    }
  };

  if (view.name === 'create') {
    return (
      <FullScreen>
        <CreateGroup
          onBack={toList}
          onCreated={(g) => {
            reload();
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
          onBack={toList}
          onJoined={(res) => {
            reload();
            toList();
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
      <GroupDetail
        group={g}
        inUse={inUse}
        onBack={toList}
        onToggleUse={() => onSelectGroup?.(inUse ? null : { id: g.id, name: g.name, members: g.members, count: g.count })}
        onInvite={() => setView({ name: 'invite', group: g, back: { name: 'detail', group: g } })}
        onRenamed={() => reload()}
        onLeft={(left) => {
          if (selectedGroup?.id === left.id) onSelectGroup?.(null);
          setGroups((list) => list.filter((x) => x.id !== left.id));
          toList();
        }}
      />
    );
  }
  return (
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
      onTogglePin={togglePin}
      onToggleMute={toggleMute}
    />
  );
}
