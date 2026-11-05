import { useEffect, useMemo, useState } from 'react';
import { color, font, layout, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { TitleHeader } from '../../components/ui/ScreenHeader';
import BottomSheet from '../../components/ui/BottomSheet';
import SheetBar from '../../components/ui/SheetBar';
import Icon from '../../components/ui/Icon';
import { Radio, RadioDisabled } from '../../components/ui/Radio';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { chara, GUIDE } from '../../lib/chara';
import { fetchMyGroups, fetchSaved, sendToGroup, setSavedHidden } from '../../lib/api';
import { externalLinks, genreLabel } from '../../lib/shop';
import { openExternal } from '../../lib/open';
import { FEATURES } from '../../lib/features';
import SavedCard, { SavedCardBody, SAVED_CARD_H } from './SavedCard';
import SendToGroupSheet from '../shop/SendToGroupSheet';

// 保存（確定版 Final-09 大きなカード型）
//   上部「保存」と並べ替え、検索「キーワードを検索」、「36件 ・ 新しい順」、大きなカードの1列
//   保存に出すのは、ひとりでいいねしたお店だけ
//   1回目の並べ替えは「新しい順・評価の高い順・予算の安い順」。年代別の評価順は Coming Soon（押せない）。
//   「同じモグタイプに人気順」「急上昇中」は3回目まで出さない
const SORTS = [
  { key: 'new', label: '新しい順' },
  { key: 'rating', label: '評価の高い順（全年代）' },
  { key: 'budget', label: '予算の安い順' },
];

function sortShops(list, key) {
  const arr = [...list];
  if (key === 'rating') arr.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.user_ratings_total) || 0) - (Number(a.user_ratings_total) || 0));
  else if (key === 'budget') arr.sort((a, b) => (a.price_level == null ? 99 : Number(a.price_level)) - (b.price_level == null ? 99 : Number(b.price_level)));
  else arr.sort((a, b) => (b._order ?? 0) - (a._order ?? 0));
  return arr;
}

function SortSheet({ open, value, onApply, onClose }) {
  const [draft, setDraft] = useState(value);
  if (!open) return null;
  const row = { width: '100%', height: 60, padding: 0, border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' };
  return (
    <BottomSheet open onClose={onClose} ariaLabel="並べ替え">
      <SheetBar title="並べ替え" onCancel={onClose} actionLabel="適用" onAction={() => onApply(draft)} />
      <div role="radiogroup" aria-label="並べ替え">
        {SORTS.map((s) => (
          <button key={s.key} type="button" role="radio" aria-checked={draft === s.key} onClick={() => setDraft(s.key)} style={{ ...row, fontWeight: draft === s.key ? 700 : 500 }}>
            {s.label}
            <Radio on={draft === s.key} />
          </button>
        ))}
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" disabled style={{ ...row, borderBottom: 0, color: color.sub, fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            年代別の評価順
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Coming Soon</span>
          </span>
          <RadioDisabled />
        </button>
      </div>
    </BottomSheet>
  );
}

// 長押しのシート（確定版 Final-09 の 3）：［グループに送る］［予約する］／［保存から外す］（赤）／［キャンセル］
function CardMenu({ shop, rect, onClose, onSend, onRemove, showSend }) {
  const links = externalLinks(shop);
  const lifted = rect ? (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: SAVED_CARD_H, borderRadius: 32, transform: 'scale(1.03)', boxShadow: `0 0 0 4px ${color.white}`, zIndex: 1, pointerEvents: 'none' }}
    >
      <SavedCardBody shop={shop} />
    </div>
  ) : null;
  return (
    <BottomSheet open onClose={onClose} padding="10px 20px 30px" ariaLabel={`${shop.name}のメニュー`} lifted={lifted}>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {showSend && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onSend} style={{ flex: '1 1 0px', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="send" size={20} color={color.white} />
            グループに送る
          </button>
        )}
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={() => {
            openExternal(links.hotpepper);
            onClose();
          }}
          style={{ flex: '1 1 0px', height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Icon name="calendar" size={20} />
          予約する
          <Icon name="external" size={14} color={color.sub} label="外のページを開きます" />
        </button>
      </div>
      <div style={{ height: 1, marginTop: 16, background: color.line }} />
      <button type="button" className="ui-btn" onClick={onRemove} style={{ width: '100%', height: 52, marginTop: 16, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.red}`, borderRadius: 26, background: color.white, color: color.red, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
        保存から外す
      </button>
      <button type="button" className="ui-btn ui-btn--text" onClick={onClose} style={{ width: '100%', height: 44, marginTop: 6, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
        キャンセル
      </button>
    </BottomSheet>
  );
}

// 0件（確定版 Final-09 の 8）：ハリー（150×229）、「ホームでいいねしたお店が、ここに並びます」、［お店を探す］
function SavedEmpty({ onGoHome }) {
  const h = chara(GUIDE.harry);
  return (
    <div style={{ position: 'absolute', left: 32, right: 32, top: 'calc(var(--safe-top) + 114px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2 }}>
      <img src={h?.framed} alt="" style={{ display: 'block', width: 150, height: 229, objectFit: 'contain', objectPosition: 'center bottom' }} />
      <p style={{ margin: '24px 0 0', fontFamily: font.dela, fontSize: 20, lineHeight: 1.5 }}>
        ホームでいいねしたお店が、
        <br />
        ここに並びます
      </p>
      <div style={{ width: 240, marginTop: 24 }}>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onGoHome} style={{ width: '100%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
          お店を探す
        </button>
      </div>
    </div>
  );
}

// ゲストのとき：下に1行「登録すると、保存したお店をグループに送れます」［登録する］（確定版 Final-14 の 5）
function GuestSavedLine({ onRegister }) {
  return (
    <div style={{ position: 'fixed', left: 20, right: 20, bottom: 108, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, background: color.white, zIndex: 30, maxWidth: 440, margin: '0 auto' }}>
      <Icon name="send" size={20} />
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>登録すると、保存したお店をグループに送れます</span>
      <button type="button" className="ui-btn ui-btn--primary" onClick={onRegister} style={{ flex: 'none', height: 44, padding: '0 14px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
        登録する
      </button>
    </div>
  );
}

export default function SavedScreen({ version = 0, onOpenShop, onGoHome, onRegister, onGuestLocked }) {
  const { user } = useAuth();
  const toast = useToast();
  const guest = !!user?.isGuest;
  const [shops, setShops] = useState(null); // null = 読み込み中
  const [status, setStatus] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [sheet, setSheet] = useState(null); // 'sort' | { menu: shop, rect } | { send: shop }
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    fetchSaved(user.id)
      .then((list) => {
        if (!alive) return;
        // 新しい順：保存した日時があれば使い、なければ届いた順の逆（あとで足したものが新しい）
        const withOrder = list.map((s, i) => ({ ...s, _order: s.saved_at ? new Date(s.saved_at).getTime() : i }));
        setShops(withOrder);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('保存の取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [user?.id, version, reloadKey]);

  useEffect(() => {
    if (!user?.id || guest || !FEATURES.sendToGroup) return undefined;
    let alive = true;
    fetchMyGroups(user.id)
      .then((g) => alive && setGroups(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.id, guest]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (shops || []).filter((s) => {
      if (!q) return true;
      return [s.name, s.area, genreLabel(s), s.address].filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
    });
    return sortShops(list, sort);
  }, [shops, query, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label || '';
  // 押しても何も起きないボタンは置かない：ゲストは登録の案内、グループがなければ［グループに送る］を出さない
  const canSend = FEATURES.sendToGroup && (guest || groups.length > 0);

  const remove = async (shop) => {
    setSheet(null);
    setShops((list) => (list || []).filter((s) => s.id !== shop.id));
    try {
      await setSavedHidden({ userId: user.id, restaurantId: shop.id, hidden: true });
    } catch (err) {
      console.error('保存から外すエラー:', err?.message || err);
      setShops((list) => [...(list || []), shop]);
      return;
    }
    toast?.show('保存から外しました', {
      undo: async () => {
        setShops((list) => [...(list || []).filter((s) => s.id !== shop.id), shop]);
        try {
          await setSavedHidden({ userId: user.id, restaurantId: shop.id, hidden: false });
        } catch (err) {
          console.error('元に戻すエラー:', err?.message || err);
        }
      },
    });
  };

  const openSend = (shop) => {
    if (guest) {
      setSheet(null);
      onGuestLocked?.();
      return;
    }
    setSheet({ send: shop });
  };

  const empty = status === 'ready' && (shops || []).length === 0;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <TitleHeader title="保存" actions={[{ icon: 'sort', label: '並べ替え', onClick: () => setSheet('sort') }]} />

      {empty ? (
        <SavedEmpty onGoHome={onGoHome} />
      ) : (
        <>
          <div role="search" style={{ flex: 'none', margin: `12px ${layout.screenX}px 0`, height: 56, boxSizing: 'border-box', padding: '0 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 18, background: color.white, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="search" size={22} color={color.sub} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="キーワードを検索"
              aria-label="キーワードを検索"
              enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, padding: 0 }}
            />
          </div>
          <p style={{ flex: 'none', margin: `12px ${layout.screenX}px 0`, minHeight: 20, fontSize: 12, fontWeight: 500, color: color.sub, lineHeight: '20px' }}>
            {status === 'ready' ? `${visible.length}件 ・ ${sortLabel}` : ''}
          </p>
          <div style={{ flex: '1 1 auto', minHeight: 0, marginTop: 8, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {status === 'loading' && <LoadingState style={{ height: '70%' }} />}
            {status === 'error' && <ErrorState kind="server" onRetry={() => { setStatus('loading'); setReloadKey((k) => k + 1); }} style={{ height: '70%' }} />}
            {status === 'ready' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: `0 ${layout.screenX}px ${layout.scrollBottom + (guest && FEATURES.sendToGroup ? 72 : 0)}px` }}>
                {visible.map((s) => (
                  <SavedCard key={s.id} shop={s} onOpen={() => onOpenShop?.(s, { from: 'saved' })} onLongPress={(rect) => setSheet({ menu: s, rect })} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {guest && FEATURES.sendToGroup && !empty && status === 'ready' && <GuestSavedLine onRegister={onRegister} />}

      {sheet === 'sort' && (
        <SortSheet
          open
          value={sort}
          onClose={() => setSheet(null)}
          onApply={(v) => {
            setSort(v);
            setSheet(null);
          }}
        />
      )}
      {sheet?.menu && (
        <CardMenu shop={sheet.menu} rect={sheet.rect} showSend={canSend} onClose={() => setSheet(null)} onSend={() => openSend(sheet.menu)} onRemove={() => remove(sheet.menu)} />
      )}
      {sheet?.send && (
        <SendToGroupSheet
          open
          shop={sheet.send}
          groups={groups}
          onClose={() => setSheet(null)}
          onSend={async (g) => {
            try {
              await sendToGroup({ userId: user.id, restaurant: sheet.send, groupId: g.id });
              setSheet(null);
              toast?.show(`${sheet.send.name}を、${g.name}に送りました`);
            } catch (err) {
              console.error('グループに送るエラー:', err?.message || err);
            }
          }}
        />
      )}
    </div>
  );
}
