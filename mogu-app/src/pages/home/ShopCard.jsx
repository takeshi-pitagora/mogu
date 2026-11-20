import { useRef } from 'react';
import { alpha, color, font, radius, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import { budgetLabel, genreLabel, isOpenNow, nearestStation, shopPhotos } from '../../lib/shop';

// ホームのお店カード（確定版 Final-08 写真全面型の寸法のまま）
//   角丸32・2ptの線・写真全面・下に向かって暗くなる重ね・上に写真の点（何枚目か）
//   写真の下のほうに白い文字で：エリアとジャンルのラベル、店名、みんなのタグ3つ、
//   「○人が保存」と予算感、最寄り駅と徒歩の分、営業中（㉔の確定版。星や点数は出さない）
export function PhotoDots({ count, index }) {
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

// 営業中の印。写真の上は白、白い地の上（お店の詳細の営業時間）は黒
export function OpenNow({ onLight = false }) {
  const c = onLight ? color.ink : color.white;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.accent, boxShadow: `0 0 0 2px ${c}` }} />
      営業中
    </span>
  );
}

export default function ShopCard({ shop, photoIndex = 0, onPhotoIndex, onOpen, interactive = true, onBeFirst }) {
  // ㉔-19 まだプロフィールがないお店（お店の名前と場所だけ。写真もタグもない）
  if (shop && !shop.is_shop) return <NoProfileCard shop={shop} onBeFirst={onBeFirst} />;
  return <PhotoCard shop={shop} photoIndex={photoIndex} onPhotoIndex={onPhotoIndex} onOpen={onOpen} interactive={interactive} />;
}

// ㉔-19 写真の代わりにクリームの地と点線の内枠
function NoProfileCard({ shop, onBeFirst }) {
  const station = nearestStation(shop);
  const genre = genreLabel(shop);
  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: radius.card, overflow: 'hidden', background: color.surface, fontFamily: font.plex, color: color.ink }}
    >
      <div style={{ position: 'absolute', inset: 10, border: `2px dashed ${color.lineStrong}`, borderRadius: radius.card - 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 18px', borderRadius: 20, background: color.ink, color: color.white, fontSize: 15, fontWeight: 700 }}>
          まだプロフィールがありません
        </span>
        <span aria-hidden="true" style={{ width: 128, height: 128, margin: '26px 0 22px', borderRadius: 64, background: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="home" size={56} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: color.sub }}>
          {[genre, station].filter(Boolean).join('・')}
        </span>
        <span className="no-zoom" style={{ marginTop: 6, fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.25 }}>{shop.name}</span>
        <span style={{ marginTop: 10, fontSize: 15, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
          お店の名前と場所だけ、公開されている情報から出しています。写真やタグはまだありません
        </span>
        <button
          type="button"
          onClick={onBeFirst}
          className="ui-btn"
          style={{ width: '100%', maxWidth: 280, height: 60, marginTop: 26, border: 0, borderRadius: 30, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 17, fontWeight: 700 }}
        >
          最初の1人になる
        </button>
      </div>
    </div>
  );
}

function PhotoCard({ shop, photoIndex = 0, onPhotoIndex, onOpen, interactive = true }) {
  const photos = shopPhotos(shop);
  const idx = Math.min(photoIndex, Math.max(0, photos.length - 1));
  // ㉔ カードは星をやめて、みんなのタグ3つ・予算感・「○人が保存」にする
  const tags = shop.tags || [];
  const savedCount = shop.saved_count ?? null;
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
      <PhotoDots count={photos.length} index={idx} />
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 58, display: 'flex', flexDirection: 'column', gap: 10, color: color.white, zIndex: 2 }}>
        {(shop.area || genre) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shop.area && <Chip>{shop.area}</Chip>}
            {genre && <Chip>{genre}</Chip>}
          </div>
        )}
        <h2 className="no-zoom" style={{ margin: 0, fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{shop.name}</h2>
        {/* ㉔ みんなのタグ（上位3つ）。星や点数は出さない */}
        {tags.length > 0 && (
          <div aria-label="ハッシュタグ（上位3つ）" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{ flex: 'none', height: 30, boxSizing: 'border-box', padding: '0 10px', border: `2px solid ${color.white}`, borderRadius: 22, background: 'rgba(46,44,42,0.48)', color: color.white, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {(savedCount != null || budget) && (
          <dl style={{ margin: 0, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            {savedCount != null && (
              <div>
                <dt style={{ fontSize: 12, fontWeight: 500, color: color.line }}>保存</dt>
                <dd style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ alignSelf: 'center' }}>
                    <Icon name="savedFill" size={20} color={color.white} />
                  </span>
                  <span className="no-zoom" style={{ fontFamily: font.dela, fontSize: 30, lineHeight: 1 }}>{savedCount}</span>
                  <span style={{ fontSize: 12, color: color.line }}>人</span>
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
