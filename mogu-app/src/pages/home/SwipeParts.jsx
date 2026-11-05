import { alpha, color, font, radius, stroke, swipeColor } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';

// ［パス］64・［戻る］48・［いいね］76（間22、どれも白いふち4）。確定版 Final-01-02-Buttons の C ／ Final-08
//   パスと戻るは白の地に2ptの線、いいねはアクセントの地に白いハート
//   スワイプ中は押したボタンも光る（いいね：外に黒い輪、パス：白黒が反転）
export function SwipeButtons({ onPass, onUndo, onLike, highlight, disabled = false, undoDisabled = false }) {
  const off = color.lineStrong;
  const circle = (size, extra) => ({
    width: size,
    height: size,
    boxSizing: 'border-box',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 4px ${color.white}`,
    ...extra,
  });
  const passOn = highlight === 'pass';
  const likeOn = highlight === 'like';
  const undoOff = disabled || undoDisabled;
  return (
    <>
      <button type="button" aria-label="パス" onClick={onPass} disabled={disabled} className="ui-btn" style={{ padding: 0, border: 0, background: 'transparent' }}>
        <span style={circle(64, { border: `${stroke.shape}px solid ${disabled ? off : color.ink}`, background: passOn ? color.ink : color.white })}>
          <Icon name="close" size={26} color={disabled ? off : passOn ? color.white : color.ink} />
        </span>
      </button>
      <button type="button" aria-label="戻る" onClick={onUndo} disabled={undoOff} className="ui-btn" style={{ padding: 0, border: 0, background: 'transparent' }}>
        <span style={circle(48, { border: `${stroke.shape}px solid ${undoOff ? off : color.ink}`, background: color.white })}>
          <Icon name="undo" size={20} color={undoOff ? off : color.ink} />
        </span>
      </button>
      <button type="button" aria-label="いいね" onClick={onLike} disabled={disabled} className="ui-btn" style={{ padding: 0, border: 0, background: 'transparent' }}>
        <span style={circle(76, { border: 0, background: disabled ? color.surface : color.accent, boxShadow: likeOn ? `0 0 0 4px ${color.white}, 0 0 0 7px ${color.ink}` : `0 0 0 4px ${color.white}` })}>
          <Icon name="heartFill" size={34} strokeWidth={2.75} color={disabled ? off : color.white} />
        </span>
      </button>
    </>
  );
}

// スワイプのステッカー（白いふち＋黒いふち＋ずれた影。影なしの決まりの例外 §3-3）
// 右（いいね）：「Like!」コバルトブルー寄りの文字 ／ 左（パス）：「Pass!」チャコール（§10-2 で「Pass!」）
// plain: カードのまん中にそのまま置く（ログインの最初の画面の見本。確定版 Final-07）
export function SwipeSticker({ kind, opacity = 1, plain = false }) {
  const like = kind === 'like';
  const text = like ? 'Like!' : 'Pass!';
  const fill = like ? swipeColor.like.text : swipeColor.pass.text;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: plain ? 'none' : `translateX(${like ? -30 : 30}px) scale(0.84)`, zIndex: 3, pointerEvents: 'none', opacity }}>
      <svg width="330" height="130" viewBox="0 0 330 130" style={{ position: 'absolute', left: '50%', top: '50%', margin: '-65px 0 0 -165px', overflow: 'visible', transform: `rotate(${like ? -10 : 10}deg)` }}>
        <text x="169" y="99" textAnchor="middle" fontFamily={font.dela} fontSize="88" letterSpacing="2" fill={color.ink} stroke={color.ink} strokeWidth="18" strokeLinejoin="round">{text}</text>
        <text x="165" y="94" textAnchor="middle" fontFamily={font.dela} fontSize="88" letterSpacing="2" fill={color.white} stroke={color.white} strokeWidth="18" strokeLinejoin="round">{text}</text>
        <text x="165" y="94" textAnchor="middle" fontFamily={font.dela} fontSize="88" letterSpacing="2" fill={fill} stroke={color.ink} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">{text}</text>
      </svg>
    </div>
  );
}

// 画面全体の光（ふちほど濃く、まん中は薄い）
export function SwipeGlow({ kind, opacity }) {
  if (!kind || opacity <= 0) return null;
  const like = kind === 'like';
  const c = like ? swipeColor.like.glow : swipeColor.pass.glow;
  const bg = like
    ? `radial-gradient(ellipse 85% 75% at 50% 48%, ${alpha(c, 0.04)} 0%, ${alpha(c, 0.14)} 62%, ${alpha(c, 0.28)} 100%)`
    : `radial-gradient(ellipse 85% 75% at 50% 48%, ${alpha(c, 0.1)} 0%, ${alpha(c, 0.3)} 62%, ${alpha(c, 0.6)} 100%)`;
  const sh = like ? `inset 0 0 70px 14px ${alpha(c, 0.42)}` : `inset 0 0 70px 14px ${alpha(c, 0.62)}`;
  return <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 12, background: bg, boxShadow: sh, opacity }} />;
}

// 見終わり（点線のふちの箱・アイコンの丸・見出し・［条件を広げる］）
export function EndOfDeck({ onWiden }) {
  return (
    <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: '0 32px', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: radius.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: font.plex, color: color.ink }}>
      <span style={{ width: 96, height: 96, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="boxCheck" size={44} />
      </span>
      <h2 style={{ margin: '20px 0 22px', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4 }}>
        この条件のお店は
        <br />
        見終わりました
      </h2>
      <div style={{ width: '100%', maxWidth: 240 }}>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onWiden} style={{ width: '100%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: font.plex, fontSize: 16, fontWeight: 700 }}>
          条件を広げる
        </button>
      </div>
    </div>
  );
}

// 読み込み中：入る中身と同じ形の灰色（確定版 Final-08 の 11）
export function LoadingCard() {
  const bar = (w, h, mt) => <span style={{ display: 'block', width: w, height: h, borderRadius: h / 2, background: color.lineStrong, marginTop: mt }} />;
  return (
    <div aria-label="読み込み中" role="status" style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: radius.card, background: color.surface }}>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 64 }}>
        {bar('34%', 26, 0)}
        {bar('72%', 26, 12)}
        {bar('52%', 18, 12)}
        {bar('40%', 14, 12)}
      </div>
    </div>
  );
}

// 初回の案内（初めて開いたときだけ。設定の「使い方をもう一度見る」からも）
// 左は「Pass」（§10-2）
export function FirstGuide({ onStart }) {
  const side = (label, icon, fill) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: color.white }}>
      <span style={{ width: 56, height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.white}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={color.white} strokeWidth={fill ? 2.75 : undefined} />
      </span>
      <span style={{ fontFamily: font.dela, fontSize: 16 }}>{label}</span>
    </div>
  );
  return (
    <>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: alpha(color.ink, 0.78), zIndex: 50 }} />
      <div role="dialog" aria-label="使い方" style={{ position: 'fixed', left: 0, right: 0, top: 'calc(var(--safe-top) + 276px)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 51, fontFamily: font.plex }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {side('Pass', 'close', false)}
          <div style={{ position: 'relative', width: 150, height: 120 }}>
            <svg width="150" height="40" viewBox="0 0 150 40" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0 }}>
              <path d="M10 20h130M22 8 10 20l12 12M128 8l12 12-12 12" fill="none" stroke={color.white} strokeWidth="3" strokeLinejoin="miter" strokeLinecap="square" />
            </svg>
            <span style={{ position: 'absolute', left: 39, top: 34, width: 72, height: 72, borderRadius: '50%', background: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-8deg)' }}>
              <Icon name="tap" size={44} color={color.ink} />
            </span>
          </div>
          {side('Like', 'heartFill', true)}
        </div>
        <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 22, color: color.white }}>左右にスワイプ</p>
        <button type="button" className="ui-btn" onClick={onStart} style={{ marginTop: 26, width: 200, height: 56, border: 0, borderRadius: 28, background: color.white, color: color.ink, fontFamily: font.plex, fontSize: 16, fontWeight: 700 }}>
          はじめる
        </button>
      </div>
    </>
  );
}
