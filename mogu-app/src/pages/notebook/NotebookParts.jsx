import { color, font, paper } from '../../theme/tokens';
import MoguCoin from '../../components/ui/MoguCoin';
import { TABS } from './tabs';

// =============================================================
// ㉖ 探検手帳の部品（確定版 Final-26）
//   黒い革の表紙・ベージュの方眼のページ・しおりのタブ・はんこ
// =============================================================

// Fraunces の斜めの数（日付・コイン・目盛りの数）
export function Num({ children, size = 18, muted = false, strike = false, weight = 700, style }) {
  return (
    <span style={{ fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: weight, fontSize: size, lineHeight: 1, color: muted ? color.sub : color.ink, textDecoration: strike ? 'line-through' : 'none', textDecorationThickness: strike ? 1.5 : undefined, ...style }}>
      {children}
    </span>
  );
}

// しっぽり明朝の見出し
export function Mincho({ children, size = 13, color: c = color.ink, style }) {
  return <span style={{ fontFamily: font.mincho, fontWeight: 800, fontSize: size, color: c, ...style }}>{children}</span>;
}

// 確定・仮・取消のはんこ（㉖-2〜4・11）
const STAMP = {
  confirmed: { label: '確定', c: '#A86C53', dashed: false, tilt: -10, size: 11, inner: true },
  pending: { label: '仮', c: color.sub, dashed: true, tilt: 6, size: 14, inner: false },
  cancelled: { label: '取消', c: '#A39A8F', dashed: false, tilt: 6, size: 11, inner: true },
};

export function CoinStamp({ state, size = 34 }) {
  const s = STAMP[state] || STAMP.pending;
  return (
    <span
      aria-label={s.label}
      style={{ position: 'relative', flex: 'none', display: 'inline-flex', width: size, height: size, boxSizing: 'border-box', border: `1.6px ${s.dashed ? 'dashed' : 'solid'} ${s.c}`, borderRadius: '50%', color: s.c, fontFamily: font.mincho, fontWeight: 800, fontSize: s.size, letterSpacing: '-0.02em', alignItems: 'center', justifyContent: 'center', transform: `rotate(${s.tilt}deg)` }}
    >
      {s.inner && <span aria-hidden="true" style={{ position: 'absolute', inset: 3, border: `1px solid ${s.c}`, borderRadius: '50%' }} />}
      {s.label}
    </span>
  );
}

// コイン。仮は色を抜いて白っぽく、取消は薄く（MoguCoin が面倒を見る）
export function Coin({ size = 15, state = 'confirmed' }) {
  return <MoguCoin size={size} state={state} />;
}

// マスキングテープ（表紙のラベルの角・いいねの長さ）
export function Tape({ w = 58, h = 18, tint = 'rgba(226,237,229,0.92)', tilt = 38, style }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: w,
        height: h,
        backgroundColor: tint,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)',
        clipPath: 'polygon(0 8%, 3% 0, 97% 0, 100% 10%, 97% 25%, 100% 42%, 97% 58%, 100% 75%, 97% 90%, 100% 100%, 3% 100%, 0 88%, 3% 72%, 0 56%, 3% 40%, 0 24%)',
        transform: `rotate(${tilt}deg)`,
        ...style,
      }}
    />
  );
}

// ベージュの方眼のページ（右にしおりのタブ）
export function Page({ tab, onTab, page = 1, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* しおり紐（右上から垂らす） */}
      <span aria-hidden="true" style={{ position: 'absolute', right: 44, top: -14, width: 11, height: 96, zIndex: 5, background: 'linear-gradient(90deg, #A86C53 0 1.5px, #C08268 1.5px 9.5px, #A86C53 9.5px)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 90%, 0 100%)' }} />
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            aria-label={t.label}
            aria-current={on ? 'page' : undefined}
            onClick={() => onTab(t.key)}
            className="ui-btn"
            style={{ position: 'absolute', right: -30, top: t.top, width: on ? 36 : 30, height: t.h, boxSizing: 'border-box', padding: 0, paddingLeft: on ? 6 : 0, border: 0, borderRadius: '0 11px 11px 0', backgroundColor: t.bg, backgroundImage: on ? 'radial-gradient(circle at 1px 1px, #DACBB0 1px, transparent 1.3px)' : undefined, backgroundSize: on ? '14px 14px' : undefined, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontFamily: font.mincho, fontWeight: 800, fontSize: 13, letterSpacing: '0.14em', zIndex: on ? 4 : 1, boxShadow: on ? 'none' : 'inset 4px 0 5px -3px rgba(46,44,42,0.45)' }}
          >
            <span aria-hidden="true" style={{ position: 'absolute', left: -14, top: 0, bottom: 0, width: 14 }} />
            {t.label}
          </button>
        );
      })}
      <div style={{ position: 'relative', zIndex: 2, minHeight: 560, boxSizing: 'border-box', padding: '18px 12px 40px 22px', borderRadius: '6px 12px 12px 6px', backgroundColor: paper.page, backgroundImage: 'radial-gradient(circle at 1px 1px, #DACBB0 1px, transparent 1.3px)', backgroundSize: '14px 14px', backgroundPosition: '6px 6px', boxShadow: 'inset 14px 0 12px -12px rgba(46,44,42,0.32), 0 3px 0 -1px #E9DEC9, 0 6px 0 -2px #D6C7AC' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 8, top: 14, bottom: 14, borderLeft: '1.5px dashed rgba(46,44,42,0.26)' }} />
        {children}
        {/* ページの番号（右下） */}
        <span aria-hidden="true" style={{ position: 'absolute', right: 16, bottom: 14, fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 600, fontSize: 12, color: color.sub }}>{page}</span>
      </div>
    </div>
  );
}

// ページの見出し（「記録 2026.11」）
export function PageTitle({ title, note }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingRight: 60 }}>
        <h2 style={{ margin: 0, fontFamily: font.mincho, fontWeight: 800, fontSize: 22, letterSpacing: '0.08em' }}>{title}</h2>
        {note && <Num size={13} muted weight={600}>{note}</Num>}
      </div>
      <div style={{ marginTop: 8, borderTop: `3px double ${color.ink}` }} />
    </>
  );
}
