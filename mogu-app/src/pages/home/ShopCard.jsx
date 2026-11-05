import { useRef } from 'react';
import { alpha, color, font, radius, stroke } from '../../theme/tokens';
import { budgetLabel, genreLabel, isOpenNow, nearestStation, ratingOf, shopPhotos } from '../../lib/shop';

// ホームのお店カード（確定版 Final-08 写真全面型の寸法のまま）
//   角丸32・2ptの線・写真全面・下に向かって暗くなる重ね・上に写真の点（何枚目か）
//   写真の下のほうに白い文字で：エリアとジャンルのラベル、店名、評価（数字と件数）、予算、最寄り駅と徒歩の分、営業中
export function photoDots(count, index) {
  if (count <= 1) return null;
  return (
    <div aria-label={`写真 ${index + 1}枚目／${count}枚`} style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ display: 'block', width: i === index ? 18 : 7, height: 7, borderRadius: 4, background: i === index ? color.white : alpha(color.white, 0.5) }} />
      ))}
    </div>
  );
}

export function Chip({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, boxSizing: 'border-box', padding: '0 12px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 15, background: color.white, color: color.ink, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export function OpenNow() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: color.white, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.accent, boxShadow: `0 0 0 2px ${color.white}` }} />
      営業中
    </span>
  );
}

export default function ShopCard({ shop, photoIndex = 0, onPhotoIndex, onOpen, interactive = true }) {
  const photos = shopPhotos(shop);
  const idx = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const rating = ratingOf(shop);
  const budget = budgetLabel(shop.price_level);
  const station = nearestStation(shop);
  const open = isOpenNow(shop.opening_hours) === true;
  const genre = genreLabel(shop);
  const down = useRef(null);

  // 写真の上の左右を押すと前後の写真、それ以外を押すとお店の詳細
  const onPointerDown = (e) => {
    down.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onClick = (e) => {
    if (!interactive) return;
    const d = down.current;
    if (d && (Math.abs(e.clientX - d.x) > 6 || Math.abs(e.clientY - d.y) > 6)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    if (photos.length > 1 && ry < 0.55 && (rx < 0.33 || rx > 0.67)) {
      const next = rx < 0.33 ? Math.max(0, idx - 1) : Math.min(photos.length - 1, idx + 1);
      onPhotoIndex?.(next);
      return;
    }
    onOpen?.();
  };

  return (
    <article
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: radius.card, overflow: 'hidden', background: color.ink, fontFamily: font.plex }}
    >
      <div role="img" aria-label={`${shop.name}の写真`} style={{ position: 'absolute', inset: 0, background: color.ink, overflow: 'hidden' }}>
        {photos[idx] && <img src={photos[idx]} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(color.ink, 0)} 34%, ${alpha(color.ink, 0.82)} 66%, ${alpha(color.ink, 0.94)} 100%)`, zIndex: 1 }} />
      {photoDots(photos.length, idx)}
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 58, display: 'flex', flexDirection: 'column', gap: 10, color: color.white, zIndex: 2 }}>
        {(shop.area || genre) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shop.area && <Chip>{shop.area}</Chip>}
            {genre && <Chip>{genre}</Chip>}
          </div>
        )}
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{shop.name}</h2>
        {(rating || budget) && (
          <dl style={{ margin: 0, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            {rating && (
              <div>
                <dt style={{ fontSize: 12, fontWeight: 500, color: color.line }}>評価</dt>
                <dd style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: font.dela, fontSize: 34, lineHeight: 1 }}>{rating.value}</span>
                  {rating.count && <span style={{ fontSize: 12, color: color.line }}>{rating.count}</span>}
                </dd>
              </div>
            )}
            {budget && (
              <div>
                <dt style={{ fontSize: 12, fontWeight: 500, color: color.line }}>予算</dt>
                <dd style={{ margin: '4px 0 0', fontFamily: font.dela, fontSize: 17, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{budget}</dd>
              </div>
            )}
          </dl>
        )}
        {(station || open) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: color.line }}>
            {station && <span>{station.label}</span>}
            {station && open && <span aria-hidden="true">·</span>}
            {open && <OpenNow />}
          </div>
        )}
      </div>
    </article>
  );
}
