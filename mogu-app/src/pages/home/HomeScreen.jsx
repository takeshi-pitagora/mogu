import { useCallback, useEffect, useRef, useState } from 'react';
import { color, font, layout } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { LOGO } from '../../lib/brand';
import { fetchDeck, fetchMyGroups, recordSwipe, undoSwipe } from '../../lib/api';
import { shopPhotos, EMPTY_FILTERS, filterCount } from '../../lib/shop';
import Icon from '../../components/ui/Icon';
import AvatarStack from '../../components/ui/AvatarStack';
import { HeaderIconButton } from '../../components/ui/ScreenHeader';
import { ErrorState } from '../../components/ui/States';
import ShopCard from './ShopCard';
import { SwipeButtons, SwipeSticker, SwipeGlow, EndOfDeck, ZeroShops, LoadingCard, FirstGuide } from './SwipeParts';
import { FilterSheet, SearchModeSheet } from './HomeSheets';
import { sceneOf } from '../../lib/scenes';
import { chara } from '../../lib/chara';

// ホーム（確定版 Final-08 写真全面型・ボタンは Final-01-02-Buttons の C）
// 見本の画面（393×852）の位置：上部は時計の帯の下、カードは上から96・下から152、ボタンは下から114・高さ76
const SWIPE_THRESHOLD = 60;
const FLICK_MIN = 12;
const FLICK_VELOCITY = 0.3;
const EXIT_MS = 180;
const ROTATE_PER_PX = 9 / 62; // 見本：62px 動くと 9°
const GUIDE_KEY = 'mogu.homeGuideSeen';

const readGuideSeen = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return true;
  }
};
const writeGuideSeen = () => {
  try {
    localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    /* 保存できない端末では、毎回は出さないだけ */
  }
};

export default function HomeScreen({ selectedGroup, onSelectGroup, onOpenShop, onOpenNotifications, unread = false, guideRequest = 0, tagRequest = null, onConsumeTagRequest, guestSlot, onGuestLocked, onOpenRegister }) {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);
  const [draftCount, setDraftCount] = useState(null); // ㉔ 絞り込みのシートの［○店を見る］
  const [zeroBest, setZeroBest] = useState(null); // ㉔-14「#夜景 を外すと 24店」
  const [photoIndex, setPhotoIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState(null); // null | 'like' | 'pass'
  const [pressed, setPressed] = useState(null);
  const [history, setHistory] = useState([]); // [{ shop, action, groupId }]
  const [sheet, setSheet] = useState(null); // null | 'filter' | 'mode'
  const [groups, setGroups] = useState([]);
  const [guide, setGuide] = useState(() => !readGuideSeen());
  const startX = useRef(0);
  const samples = useRef([]);
  const draggingRef = useRef(false);
  const dxRef = useRef(0);

  // 設定の「使い方をもう一度見る」から
  const [lastGuideRequest, setLastGuideRequest] = useState(guideRequest);
  if (guideRequest !== lastGuideRequest) {
    setLastGuideRequest(guideRequest);
    if (guideRequest > 0) setGuide(true);
  }

  // ㉕-15 保存の［ホームで #○○ のお店を探す］から。そのタグだけで絞ってホームを出す
  const [lastTagRequest, setLastTagRequest] = useState(null);
  if (tagRequest && tagRequest !== lastTagRequest) {
    setLastTagRequest(tagRequest);
    setFilters((f) => ({ ...f, tags: [tagRequest] }));
    onConsumeTagRequest?.();
  }

  useEffect(() => {
    let alive = true;
    fetchDeck({ user, filters, group: selectedGroup })
      .then((list) => {
        if (!alive) return;
        setShops(list);
        setIndex(0);
        setHistory([]);
        setPhotoIndex(0);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('店舗取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedGroup?.id, filters, reloadKey]);

  // ㉔-14 0店のとき、どのタグを外すといちばん増えるかを数える
  useEffect(() => {
    const tags = filters.tags || [];
    if (!(status === 'ready' && shops.length === 0 && tags.length > 0)) return undefined;
    let alive = true;
    Promise.all(tags.map((t) => fetchDeck({
      user,
      filters: { ...filters, tags: tags.filter((x) => x !== t) },
      group: selectedGroup,
    }).then((l) => ({ tag: t, n: l.length })).catch(() => ({ tag: t, n: 0 }))))
      .then((rows) => {
        if (!alive) return;
        const top = rows.sort((a, b) => b.n - a.n)[0];
        setZeroBest(top && top.n > 0 ? { ...top, key: tags.join('|') } : null);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, shops.length, filters, user?.id, selectedGroup?.id]);

  // ㉔ 条件を変えるたびに、合うお店の数を数える（選ぶたびに数が変わる）
  const countFor = useCallback((draft) => {
    fetchDeck({ user, filters: draft, group: selectedGroup })
      .then((list) => setDraftCount(list.length))
      .catch(() => setDraftCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedGroup?.id]);

  useEffect(() => {
    if (!user?.id || user.isGuest) return undefined;
    let alive = true;
    fetchMyGroups(user.id)
      .then((g) => alive && setGroups(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.id, user?.isGuest, sheet]);

  // 次のカードの写真を先に読み込んでおく
  useEffect(() => {
    const next = shops[index + 1];
    const url = next && shopPhotos(next)[0];
    if (url) new Image().src = url;
  }, [shops, index]);

  const current = shops[index];
  const next = shops[index + 1];

  const reload = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  const commit = (action) => {
    const shop = current;
    if (!shop) return;
    setExit(action);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setPhotoIndex(0);
      setDragX(0);
      setExit(null);
      setPressed(null);
    }, EXIT_MS);
    const groupId = selectedGroup?.id || null;
    setHistory((h) => [...h, { shop, action, groupId }]);
    recordSwipe({ userId: user?.id, restaurant: shop, action: action === 'like' ? 'like' : 'nope', groupId, moguTypeCode: user?.moguType?.code }).catch((err) => console.error('スワイプ保存エラー:', err?.message || err));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || exit) return;
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    setPhotoIndex(0);
    undoSwipe({ userId: user?.id, restaurant: last.shop, action: last.action === 'like' ? 'like' : 'nope', groupId: last.groupId }).catch(() => {});
  };

  // ---- スワイプ ----
  const onPointerDown = (e) => {
    if (exit || draggingRef.current) return;
    draggingRef.current = true;
    dxRef.current = 0;
    startX.current = e.clientX;
    samples.current = [{ x: e.clientX, t: e.timeStamp }];
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startX.current;
    dxRef.current = dx;
    samples.current.push({ x: e.clientX, t: e.timeStamp });
    if (samples.current.length > 6) samples.current.shift();
    setDragX(dx);
  };
  const onPointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const dx = dxRef.current;
    const pts = samples.current.filter((p) => (e?.timeStamp ?? 0) - p.t <= 100);
    const use = pts.length >= 2 ? pts : samples.current.slice(-2);
    const v = use.length >= 2 && use[use.length - 1].t > use[0].t ? (use[use.length - 1].x - use[0].x) / (use[use.length - 1].t - use[0].t) : 0;
    if (dx > SWIPE_THRESHOLD || (v > FLICK_VELOCITY && dx > FLICK_MIN)) commit('like');
    else if (dx < -SWIPE_THRESHOLD || (v < -FLICK_VELOCITY && dx < -FLICK_MIN)) commit('pass');
    else setDragX(0);
  };

  let tx = dragX;
  let rot = dragX * ROTATE_PER_PX;
  if (exit === 'like') {
    tx = 600;
    rot = 22;
  } else if (exit === 'pass') {
    tx = -600;
    rot = -22;
  }
  const strength = exit ? 1 : Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD);
  const dir = exit || pressed || (dragX > 4 ? 'like' : dragX < -4 ? 'pass' : null);
  const highlight = exit || pressed || (Math.abs(dragX) >= SWIPE_THRESHOLD ? (dragX > 0 ? 'like' : 'pass') : null);

  const press = (action) => {
    if (!current || exit) return;
    setPressed(action);
    commit(action);
  };

  const fCount = filterCount(filters);
  const scene = sceneOf(filters.scene);
  const modeTitle = selectedGroup ? selectedGroup.name : 'ひとりで探す';
  const showDeck = status === 'ready' && current;
  const ended = status === 'ready' && !current;
  // ㉔-14 条件に合うお店が1店もないとき
  const zero = status === 'ready' && shops.length === 0 && (fCount > 0 || (filters.tags?.length || 0) > 0);

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      {/* 上部：左に絞り込み、まん中にロゴ、右にベル */}
      <header style={{ position: 'absolute', left: 0, right: 0, top: 'var(--safe-top)', height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 4 }}>
        <HeaderIconButton icon="filter" label={fCount > 0 ? `絞り込み（${fCount}つの条件で絞り込み中）` : '絞り込み'} badge={fCount} onClick={() => setSheet('filter')} />
        <img src={LOGO.black} alt="mogu" style={{ display: 'block', width: 75, height: 26, objectFit: 'contain' }} />
        <HeaderIconButton icon="bell" label={unread ? 'お知らせ（未読あり）' : 'お知らせ'} dot={unread} onClick={onOpenNotifications} />
      </header>

      {/* 探し方の切り替え */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(var(--safe-top) + 45px)', display: 'flex', justifyContent: 'center', zIndex: 3 }}>
        <button type="button" aria-label="探し方を切り替える" className="ui-btn ui-btn--text" onClick={() => setSheet('mode')} style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: font.plex, display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
          {selectedGroup?.members?.length > 0 && <AvatarStack members={selectedGroup.members} size={26} total={selectedGroup.count} />}
          <span style={{ fontFamily: font.dela, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modeTitle}</span>
          <Icon name="chevronDown" size={18} />
        </button>
      </div>

      {/* ㉔-15・18 絞ったあと：カードの左上に小さなキャラとシーンの名前（タグだけなら「#○○ のお店」）。×で外す */}
      {(scene || filters.tags?.length > 0) && (
        <div style={{ position: 'absolute', left: layout.screenXTight, top: 'calc(var(--safe-top) + 96px)', zIndex: 5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: scene ? '0 6px 0 6px' : '0 6px 0 14px', borderRadius: 20, background: color.ink, color: color.white }}>
            {scene && (
              <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 28, borderRadius: 14, background: color.white, overflow: 'hidden' }}>
                <img src={chara(scene.chara)?.framed} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {scene ? scene.label : `#${filters.tags[0]} のお店`}
            </span>
            <button
              type="button"
              aria-label="この絞り込みを外す"
              onClick={() => { setStatus('loading'); setFilters({ ...filters, scene: null, tags: [] }); }}
              className="ui-btn"
              style={{ flex: 'none', width: 28, height: 28, padding: 0, border: 0, borderRadius: 14, background: 'transparent', color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={15} color={color.white} strokeWidth={2.5} />
            </button>
          </span>
        </div>
      )}

      {/* カード */}
      <div style={{ position: 'absolute', left: layout.screenXTight, right: layout.screenXTight, top: 'calc(var(--safe-top) + 96px)', bottom: 152 }}>
        {status === 'loading' && <LoadingCard />}
        {status === 'error' && <ErrorState onRetry={reload} style={{ position: 'absolute', inset: 0 }} />}
        {zero && (
          <ZeroShops
            tags={filters.tags || []}
            best={zeroBest?.key === (filters.tags || []).join('|') ? zeroBest : null}
            onDropTag={(t) => { setStatus('loading'); setFilters({ ...filters, tags: (filters.tags || []).filter((x) => x !== t) }); }}
            onRegister={onOpenRegister}
          />
        )}
        {!zero && ended && (
          <EndOfDeck
            onWiden={() => setSheet('filter')}
            onClearTags={filters.tags?.length > 0 ? () => { setStatus('loading'); setFilters({ ...filters, scene: null, tags: [] }); } : null}
            onRegister={onOpenRegister}
          />
        )}
        {showDeck && next && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <ShopCard shop={next} interactive={false} />
          </div>
        )}
        {showDeck && (
          <div
            key={current.id}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              transform: `translateX(${tx}px) rotate(${rot}deg)`,
              transformOrigin: '50% 100%',
              transition: dragging ? 'none' : `transform ${EXIT_MS}ms ease-out`,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <ShopCard shop={current} photoIndex={photoIndex} onPhotoIndex={setPhotoIndex} onOpen={() => onOpenShop?.(current, { from: 'home' })} onBeFirst={() => onOpenRegister?.(current)} />
            {dir && strength > 0 && <SwipeSticker kind={dir} opacity={strength} />}
          </div>
        )}
      </div>

      {/* ［パス］［戻る］［いいね］：カードの下のふちに重ねる */}
      {status !== 'error' && !ended && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 114, height: 76, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, zIndex: 6 }}>
          <SwipeButtons
            onPass={() => press('pass')}
            onUndo={undo}
            onLike={() => press('like')}
            highlight={highlight}
            disabled={status !== 'ready' || !current}
            undoDisabled={history.length === 0}
          />
        </div>
      )}

      <SwipeGlow kind={dir} opacity={dir ? strength : 0} />

      {guide && status === 'ready' && current && (
        <FirstGuide
          onStart={() => {
            writeGuideSeen();
            setGuide(false);
          }}
        />
      )}

      {sheet === 'filter' && (
        <FilterSheet
          open
          value={filters}
          count={draftCount}
          onCount={countFor}
          onClose={() => setSheet(null)}
          onApply={(f) => {
            setSheet(null);
            setStatus('loading');
            setFilters(f);
          }}
        />
      )}
      {sheet === 'mode' && (
        <SearchModeSheet
          open
          groups={groups}
          selectedGroupId={selectedGroup?.id}
          guestSlot={guestSlot?.(() => setSheet(null))}
          onClose={() => setSheet(null)}
          onSelect={(g) => {
            setSheet(null);
            if (user?.isGuest && g) {
              onGuestLocked?.();
              return;
            }
            if ((g?.id || null) !== (selectedGroup?.id || null)) {
              setStatus('loading');
              onSelectGroup?.(g);
            }
          }}
        />
      )}
    </div>
  );
}
