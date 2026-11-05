import { useRef, useState } from 'react';
import { alpha, color, font, radius, stroke } from '../../theme/tokens';
import { budgetLabel, genreLabel, isOpenNow, nearestStation, ratingOf, shopPhotos } from '../../lib/shop';
import { OpenNow } from '../home/ShopCard';

// 保存のカード（確定版 Final-09 大きなカード型の寸法のまま）
//   高さ262・角丸32・2ptの線・写真全面（カードの中で左右に送れる）・下に向かって暗くなる重ね
//   右上に「評価 4.2」の白いカプセル、左下に写真の点、店名（Dela 21）、エリア・ジャンル・予算、最寄り駅と徒歩・営業中
//   押すとお店の詳細、長押しでメニュー
export const SAVED_CARD_H = 262;
const LONG_PRESS_MS = 480;
const SLOP = 8;

export function SavedCardBody({ shop, index = 0, offset = 0, dragging = false }) {
  const photos = shopPhotos(shop);
  const rating = ratingOf(shop);
  const budget = budgetLabel(shop.price_level);
  const station = nearestStation(shop);
  const open = isOpenNow(shop.opening_hours) === true;
  const genre = genreLabel(shop);
  const place = [shop.area, genre].filter(Boolean).join('・');
  return (
    <article
      style={{ position: 'relative', width: '100%', height: SAVED_CARD_H, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: radius.card, overflow: 'hidden', background: color.ink, fontFamily: font.plex }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', display: 'flex', transform: `translateX(calc(${-index * 100}% + ${offset}px))`, transition: dragging ? 'none' : 'transform 0.22s ease-out' }}>
        {(photos.length > 0 ? photos : [null]).map((src, i) => (
          <div key={i} role="img" aria-label={`${shop.name}の写真`} style={{ position: 'relative', flex: 'none', width: '100%', height: '100%', background: color.ink, overflow: 'hidden' }}>
            {src && Math.abs(i - index) <= 1 && <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
          </div>
        ))}
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(color.ink, 0)} 26%, ${alpha(color.ink, 0.84)} 70%, ${alpha(color.ink, 0.94)} 100%)`, zIndex: 1 }} />
      {photos.length > 1 && (
        <div aria-label={`写真 ${index + 1}枚目／${photos.length}枚`} style={{ position: 'absolute', bottom: 98, left: 18, display: 'flex', gap: 5, zIndex: 2 }}>
          {photos.map((_, i) => (
            <span key={i} style={{ display: 'block', width: i === index ? 18 : 7, height: 7, borderRadius: 4, background: i === index ? color.white : alpha(color.white, 0.5) }} />
          ))}
        </div>
      )}
      {rating && (
        <span style={{ position: 'absolute', right: 14, top: 14, display: 'flex', alignItems: 'baseline', gap: 4, height: 32, boxSizing: 'border-box', padding: '0 12px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 16, background: color.white, fontSize: 11, fontWeight: 700, color: color.sub, lineHeight: '28px', zIndex: 2 }}>
          評価
          <span style={{ fontFamily: font.dela, fontSize: 15, color: color.ink }}>{rating.value}</span>
        </span>
      )}
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: color.white, zIndex: 2 }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 21, fontWeight: 400, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</h2>
        {(place || budget) && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: color.line, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {place && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{place}</span>}
            {place && budget && <span aria-hidden="true">·</span>}
            {budget && <span style={{ fontFamily: font.dela, fontSize: 14, color: color.white }}>{budget}</span>}
          </div>
        )}
        {(station || open) && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: color.line }}>
            {station && <span>{station.label}</span>}
            {station && open && <span aria-hidden="true">·</span>}
            {open && <OpenNow />}
          </div>
        )}
      </div>
    </article>
  );
}

export default function SavedCard({ shop, onOpen, onLongPress }) {
  const photos = shopPhotos(shop);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef(null); // { x, y, mode: null | 'h' | 'v', long: bool, timer }
  const ref = useRef(null);

  const clear = () => {
    if (g.current?.timer) clearTimeout(g.current.timer);
  };

  const onPointerDown = (e) => {
    clear();
    const st = { x: e.clientX, y: e.clientY, mode: null, long: false, timer: null, id: e.pointerId };
    st.timer = setTimeout(() => {
      if (!g.current || g.current.mode) return;
      g.current.long = true;
      const rect = ref.current?.getBoundingClientRect();
      onLongPress?.(rect);
    }, LONG_PRESS_MS);
    g.current = st;
  };
  const onPointerMove = (e) => {
    const st = g.current;
    if (!st || st.long) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.mode) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) && photos.length > 1) {
        st.mode = 'h';
        clear();
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(dy) > SLOP || Math.abs(dx) > SLOP) {
        st.mode = 'v';
        clear();
      }
    }
    if (st.mode === 'h') {
      const atEdge = (index === 0 && dx > 0) || (index === photos.length - 1 && dx < 0);
      setOffset(atEdge ? dx * 0.3 : dx);
    }
  };
  const onPointerUp = (e) => {
    const st = g.current;
    g.current = null;
    clear();
    if (!st) return;
    if (st.mode === 'h') {
      const dx = e.clientX - st.x;
      setDragging(false);
      setOffset(0);
      if (dx < -40) setIndex((i) => Math.min(photos.length - 1, i + 1));
      else if (dx > 40) setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (!st.mode && !st.long && e.type === 'pointerup') onOpen?.();
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${shop.name}の詳細を開く`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', cursor: 'pointer' }}
    >
      <SavedCardBody shop={shop} index={index} offset={offset} dragging={dragging} />
    </div>
  );
}
