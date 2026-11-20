import { color, font, paper, stroke } from '../../theme/tokens';
import VisitStamp from '../../components/ui/VisitStamp';
import logo from '../../assets/brand/mogu_logo_black.png';
import { PER_SHEET, dotDate, sheetRange, shortDate, tiltOf } from '../../lib/stampBook';

// =============================================================
// ③スタンプ帳-2・3・7 台紙
//   うすいベージュのカード（2pt の線・角丸22）に9マス（3×3）。
//   行った順に左上から。スタンプ（84）の下に店名（12・太字）と日付。
//   空いているマスは点線の枠と番号。上に「3枚目」と期間、右に「6 / 9」、右下にロゴ。
// =============================================================

const CELL = 94;
const STAMP = 84;

export default function StampSheet({ index, stamps, todayIso, onOpen, width = 329 }) {
  const n = stamps.length;
  return (
    <div style={{ flex: 'none', width, boxSizing: 'border-box', padding: '16px 16px 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: paper.page }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: 34, lineHeight: 1 }}>{index + 1}</span>
            <span style={{ fontFamily: font.mincho, fontWeight: 800, fontSize: 17 }}>枚目</span>
          </div>
          <div style={{ marginTop: 5, fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 600, fontSize: 14, color: color.sub }}>{sheetRange(stamps)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{n}</span>
          <span style={{ fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 600, fontSize: 16, color: color.sub }}>/ {PER_SHEET}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: `${stroke.shape}px dashed ${color.ink}` }} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CELL}px)`, justifyContent: 'space-between', rowGap: 12, marginTop: 14 }}>
        {Array.from({ length: PER_SHEET }, (_, i) => {
          const s = stamps[i];
          if (!s) {
            return (
              <span key={`e${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: CELL }}>
                <span style={{ width: STAMP, height: Math.round(STAMP * 1.12), boxSizing: 'border-box', border: `${stroke.shape}px dashed ${paper.slotLine}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 600, fontSize: 22, color: paper.slotLine }}>
                  {i + 1}
                </span>
                <span style={{ display: 'block', height: 40 }} />
              </span>
            );
          }
          const today = s.visited_on === todayIso;
          return (
            <button
              key={s.id}
              type="button"
              className="ui-btn"
              onClick={() => onOpen?.(s)}
              aria-label={`${s.visited_on} ${s.shop_name} のスタンプ`}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: CELL, padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'center' }}
            >
              {today && (
                <span style={{ position: 'absolute', left: -2, top: -6, zIndex: 2, height: 20, padding: '0 7px', borderRadius: 10, background: color.ink, color: color.white, fontSize: 11, fontWeight: 700, lineHeight: '20px' }}>今日</span>
              )}
              <VisitStamp code={s.stamp_character} name={s.shop_name} date={dotDate(s.visited_on)} size={STAMP} tilt={tiltOf(index * PER_SHEET + i)} />
              <span style={{ display: 'block', width: CELL, marginTop: 6, textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.shop_name}</span>
                <span style={{ display: 'block', marginTop: 1, fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: color.sub }}>{shortDate(s.visited_on)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <img src={logo} alt="mogu" style={{ display: 'block', height: 16 }} />
      </div>
    </div>
  );
}
