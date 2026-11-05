import { useEffect, useRef, useState } from 'react';
import { alpha, color, font, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Icon from '../../components/ui/Icon';
import { Chip, OpenNow } from '../home/ShopCard';
import { budgetLabel, closedDaysText, externalLinks, genreLabel, isOpenNow, nearestStation, RATING_SOURCE, ratingOf, shopPhotos, todayHoursText } from '../../lib/shop';
import { fetchMyGroups, fetchSaved, saveShop, sendToGroup, setSavedHidden } from '../../lib/api';
import { canShare, openExternal, shareText } from '../../lib/open';
import SendToGroupSheet from './SendToGroupSheet';
import { FEATURES } from '../../lib/features';

// お店の詳細（確定版 Final-09 の 9・10・11）
//   写真（高さ540・横に送る・点）、右上に［共有］［閉じる］。下のほうにエリアとジャンル、店名（Dela 30）、評価（Dela 48）と件数・データ元
//   年代別の評価（Coming Soon・点線のふちで「？」）、情報（予算・営業時間・最寄り駅・住所・電話）
//   ［ホットペッパーで予約する］、「Googleマップで経路を確認」「食べログでメニューを見る」
//   下に固定：［保存済み］（まだなら［保存］）と［グループに送る］。下にスクロールすると上に店名の帯
const PHOTO_H = 540;
const AGES = ['10代', '20代', '30代', '40代', '50代以上'];

function RoundButton({ icon, label, onClick }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="ui-btn ui-btn--secondary" style={{ width: 44, height: 44, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', padding: 0, background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} />
    </button>
  );
}

function InfoRow({ icon, label, children, last }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: last ? 0 : `1px solid ${color.line}` }}>
      <Icon name={icon} size={22} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: color.sub }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 15, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

function LinkRow({ icon, children, onClick, last }) {
  return (
    <button type="button" onClick={onClick} className="ui-btn ui-btn--text" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: 0, border: 0, borderBottom: last ? 0 : `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, textAlign: 'left' }}>
      <Icon name={icon} size={22} />
      <span style={{ flex: 1 }}>{children}</span>
      <Icon name="external" size={18} color={color.sub} label="外のページを開きます" />
    </button>
  );
}

export default function ShopDetail({ shop, from = 'saved', onClose, onSavedChange, onGuestLocked }) {
  const { user } = useAuth();
  const toast = useToast();
  const guest = !!user?.isGuest;
  const photos = shopPhotos(shop);
  const [photo, setPhoto] = useState(0);
  const [saved, setSaved] = useState(from === 'saved');
  const [groups, setGroups] = useState([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const swipe = useRef(null);

  // ホームから開いたとき：もう保存しているかを確かめる
  useEffect(() => {
    if (from === 'saved' || !user?.id) return undefined;
    let alive = true;
    fetchSaved(user.id)
      .then((list) => alive && setSaved(list.some((s) => s.id === shop.id)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [from, user?.id, shop.id]);

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

  const rating = ratingOf(shop);
  const budget = budgetLabel(shop.price_level);
  const station = nearestStation(shop);
  const open = isOpenNow(shop.opening_hours) === true;
  const hoursText = todayHoursText(shop.opening_hours);
  const closed = closedDaysText(shop.opening_hours);
  const genre = genreLabel(shop);
  const links = externalLinks(shop);
  const phone = shop.phone || shop.national_phone_number || null;
  const canSend = FEATURES.sendToGroup && (guest || groups.length > 0);

  const toggleSave = async () => {
    if (!user?.id) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) await saveShop({ userId: user.id, restaurant: shop });
      else await setSavedHidden({ userId: user.id, restaurantId: shop.id, hidden: true });
      onSavedChange?.();
    } catch (err) {
      console.error('保存エラー:', err?.message || err);
      setSaved(!next);
    }
  };

  const onPhotoDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPhotoUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    setPhoto((i) => (dx < 0 ? Math.min(photos.length - 1, i + 1) : Math.max(0, i - 1)));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={shop.name} className="ui-sub-enter" style={{ position: 'fixed', inset: 0, zIndex: 60, background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <div onScroll={(e) => setScrolled(e.currentTarget.scrollTop > PHOTO_H - 110)} style={{ position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* 写真と名前・評価 */}
        <div
          onPointerDown={onPhotoDown}
          onPointerUp={onPhotoUp}
          onPointerCancel={() => (swipe.current = null)}
          style={{ position: 'relative', height: PHOTO_H, overflow: 'hidden', borderBottom: `${stroke.shape}px solid ${color.ink}`, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', transform: `translateX(${-photo * 100}%)`, transition: 'transform 0.25s ease-out' }}>
            {(photos.length > 0 ? photos : [null]).map((src, i) => (
              <div key={i} role="img" aria-label={`${shop.name}の写真`} style={{ flex: 'none', width: '100%', height: '100%', background: color.ink }}>
                {src && Math.abs(i - photo) <= 1 && <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
              </div>
            ))}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(color.ink, 0)} 38%, ${alpha(color.ink, 0.86)} 72%, ${alpha(color.ink, 0.95)} 100%)` }} />
          {photos.length > 1 && (
            <div aria-label={`写真 ${photo + 1}枚目／${photos.length}枚`} style={{ position: 'absolute', top: 'calc(var(--safe-top) + 12px)', left: 20, display: 'flex', gap: 5, zIndex: 2 }}>
              {photos.map((_, i) => (
                <span key={i} style={{ display: 'block', width: i === photo ? 18 : 7, height: 7, borderRadius: 4, background: i === photo ? color.white : alpha(color.white, 0.5) }} />
              ))}
            </div>
          )}
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 24, color: color.white }}>
            {(shop.area || genre) && (
              <div style={{ display: 'flex', gap: 6 }}>
                {shop.area && <Chip>{shop.area}</Chip>}
                {genre && <Chip>{genre}</Chip>}
              </div>
            )}
            <h1 className="no-zoom" style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 30, fontWeight: 400, lineHeight: 1.2 }}>{shop.name}</h1>
            {rating && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, color: color.white }}>
                  <span className="no-zoom" style={{ fontFamily: font.dela, fontSize: 48, lineHeight: 1 }}>{rating.value}</span>
                  <span style={{ paddingBottom: 4 }}>
                    {rating.count && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: color.line }}>{rating.count}</span>}
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: color.line }}>評価：{RATING_SOURCE}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0 20px 150px' }}>
          {/* 年代別の評価（Coming Soon） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px' }}>
            <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>年代別の評価</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Coming Soon</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {AGES.map((a) => (
              <div key={a} aria-label={`${a}の評価はまだありません`} style={{ flex: '1 1 0px', minWidth: 0, height: 72, boxSizing: 'border-box', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: 18, background: color.white, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: color.sub, whiteSpace: 'nowrap' }}>{a}</span>
                <span aria-hidden="true" style={{ fontFamily: font.dela, fontSize: 20, lineHeight: 1.1, color: color.lineStrong }}>？</span>
              </div>
            ))}
          </div>

          {/* 情報 */}
          <div style={{ marginTop: 24 }}>
            <div style={{ borderTop: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
              {(() => {
                const rows = [];
                if (budget) rows.push({ icon: 'yen', label: '予算', body: <span style={{ fontFamily: font.dela, fontSize: 16 }}>{budget}</span> });
                if (hoursText || open || closed)
                  rows.push({
                    icon: 'clock',
                    label: '営業時間',
                    body: (
                      <>
                        {(open || hoursText) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {open && <OpenNow onLight />}
                            {hoursText && <span>{hoursText}</span>}
                          </span>
                        )}
                        {closed && <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>定休日：{closed}</span>}
                      </>
                    ),
                  });
                if (station) rows.push({ icon: 'train', label: '最寄り駅', body: station.label });
                if (shop.address) rows.push({ icon: 'location', label: '住所', body: shop.address });
                if (phone)
                  rows.push({
                    icon: 'phone',
                    label: '電話',
                    body: (
                      <a href={`tel:${String(phone).replace(/[^0-9+]/g, '')}`} style={{ color: color.ink, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        {phone}
                      </a>
                    ),
                  });
                return rows.map((r, i) => (
                  <InfoRow key={r.label} icon={r.icon} label={r.label} last={i === rows.length - 1}>
                    {r.body}
                  </InfoRow>
                ));
              })()}
            </div>
          </div>

          {/* 外のページ */}
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => openExternal(links.hotpepper)} style={{ width: '100%', height: 56, marginTop: 24, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="calendar" size={22} color={color.white} />
            ホットペッパーで予約する
            <Icon name="external" size={16} color={color.white} label="外のページを開きます" />
          </button>
          <div style={{ marginTop: 8 }}>
            <LinkRow icon="route" onClick={() => openExternal(links.maps)}>Googleマップで経路を確認</LinkRow>
            <LinkRow icon="book" onClick={() => openExternal(links.tabelog)} last>食べログでメニューを見る</LinkRow>
          </div>
        </div>
      </div>

      {/* 下にスクロールしたとき：上に店名の帯 */}
      {scrolled && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 'calc(var(--safe-top) + 56px)', boxSizing: 'border-box', padding: 'var(--safe-top) 0 0 20px', background: color.white, borderBottom: `${stroke.shape}px solid ${color.ink}`, display: 'flex', alignItems: 'center', zIndex: 7 }}>
          <span style={{ maxWidth: 236, fontFamily: font.dela, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</span>
        </div>
      )}

      {/* 右上：［共有］［閉じる］ */}
      <div style={{ position: 'absolute', right: 12, top: 'var(--safe-top)', display: 'flex', gap: 8, zIndex: 8 }}>
        {canShare() && <RoundButton icon="share" label="共有" onClick={() => shareText({ title: shop.name, text: shop.name, url: links.maps })} />}
        <RoundButton icon="close" label="閉じる" onClick={onClose} />
      </div>

      {/* 下に固定：［保存済み］／［保存］と［グループに送る］ */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px 34px', borderTop: `${stroke.shape}px solid ${color.ink}`, background: color.white, display: 'flex', gap: 10, zIndex: 8 }}>
        <button
          type="button"
          aria-pressed={saved}
          onClick={toggleSave}
          className="ui-btn ui-btn--secondary"
          style={{ flex: '1 1 0px', height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="heartFill" size={22} color={saved ? color.accent : color.lineStrong} />
          {saved ? '保存済み' : '保存'}
        </button>
        {canSend && (
          <button
            type="button"
            onClick={() => (guest ? onGuestLocked?.() : setSendOpen(true))}
            className="ui-btn ui-btn--primary"
            style={{ flex: '1.35 1 0px', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="send" size={20} color={color.white} />
            グループに送る
          </button>
        )}
      </div>

      <SendToGroupSheet
        open={sendOpen}
        shop={shop}
        groups={groups}
        onClose={() => setSendOpen(false)}
        onSend={async (g) => {
          try {
            await sendToGroup({ userId: user.id, restaurant: shop, groupId: g.id });
            setSendOpen(false);
            toast?.show(`${shop.name}を、${g.name}に送りました`);
          } catch (err) {
            console.error('グループに送るエラー:', err?.message || err);
          }
        }}
      />
    </div>
  );
}
