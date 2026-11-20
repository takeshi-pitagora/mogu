import { color, font, stroke } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import VisitStamp from '../../components/ui/VisitStamp';
import { chara } from '../../lib/chara';
import { HIGHLIGHTS, TIME_OF_DAY, budgetBucketLabel } from '../../lib/registerForm';
import { TYPES } from '../../lib/mogutype';
import { dotDate, longDate, shortDate, tiltOf } from '../../lib/stampBook';

// =============================================================
// ③スタンプ帳-4・5 スタンプを押したときのシート
//   行った日・店名・ジャンルとエリア・出たキャラ・
//   自分の答え（よかった・予算・ひとこと）・このお店のスタンプ、［お店のページを見る］
// =============================================================

function Line({ k, v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minHeight: 56, borderTop: `1px solid ${color.line}`, padding: '8px 0' }}>
      <span style={{ flex: 'none', fontSize: 14, fontWeight: 500, color: color.sub }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 16, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

export default function StampDetailSheet({ stamp, onClose, onOpenShop }) {
  if (!stamp) return null;
  const type = TYPES[stamp.stamp_character];
  const ch = chara(stamp.stamp_character);
  const highs = (stamp.highlights || []).map((k) => HIGHLIGHTS.find((h) => h.key === k)?.label || k);
  const budget = (stamp.budget || [])
    .map((b) => `${TIME_OF_DAY.find((t) => t.value === b.time_of_day)?.label || ''}・${budgetBucketLabel(b.bucket) || ''}`)
    .join('　');
  const place = [stamp.genre_main, stamp.station_name].filter(Boolean).join('・');
  const shopStamps = stamp.shop_stamps || [];

  return (
    <BottomSheet open onClose={onClose} ariaLabel={`${stamp.shop_name}のスタンプ`} maxHeight="86%">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginTop: 10 }}>
        <VisitStamp code={stamp.stamp_character} name={stamp.shop_name} date={dotDate(stamp.visited_on)} size={118} tilt={-5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{longDate(stamp.visited_on)}</div>
          <h2 style={{ margin: '6px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.25 }}>{stamp.shop_name}</h2>
          {place && <div style={{ marginTop: 4, fontSize: 14, color: color.sub }}>{place}</div>}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {ch?.display && <img src={ch.display} alt="" style={{ display: 'block', width: 30, height: 30, borderRadius: '50%', border: `${stroke.shape}px solid ${color.ink}`, objectFit: 'cover' }} />}
            <span style={{ fontFamily: font.dela, fontSize: 16 }}>{stamp.stamp_character}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{type?.name || ''}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Line k="よかった" v={highs.join('・') || 'なし'} />
        {budget && <Line k="予算" v={budget} />}
      </div>

      {stamp.comment && (
        <div style={{ borderTop: `1px solid ${color.line}`, paddingTop: 12, marginTop: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: color.sub }}>ひとこと</div>
          <p style={{ margin: '4px 0 0', fontSize: 16, lineHeight: 1.6 }}>{stamp.comment}</p>
        </div>
      )}

      {shopStamps.length > 1 && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${color.line}`, paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, fontWeight: 500, color: color.sub }}>
            このお店のスタンプ
            <span style={{ fontFamily: font.dela, fontSize: 15, color: color.ink }}>{shopStamps.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {shopStamps.map((v, i) => (
              <span key={v.id} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <VisitStamp code={v.stamp_character} name={stamp.shop_name} date={dotDate(v.visited_on)} size={70} tilt={tiltOf(i)} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{shortDate(v.visited_on).replace('.', '/')}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="ui-btn ui-btn--primary"
        onClick={() => onOpenShop?.(stamp.shop_id)}
        style={{ width: '100%', height: 56, marginTop: 20, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
      >
        お店のページを見る
      </button>
    </BottomSheet>
  );
}
