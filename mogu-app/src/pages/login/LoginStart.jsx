import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { LOGO } from '../../lib/brand';
import Icon from '../../components/ui/Icon';
import { SwipeSticker, SwipeGlow } from '../home/SwipeParts';
import { TextLink } from './LoginParts';

// 最初の画面（確定版 Final-07 の 1・2）
//   ロゴ（115×40）、キャッチコピー、お店カードの見本（2枚重ね・0.7倍）。
//   カードが左へ流れると「Pass!」とライトグレーの光、右へ流れると「Like!」とコバルトブルーの光。3秒ごとにくり返す（押しても何も起きない）
//   ［新規アカウント登録］［ログイン］「登録せずにお試し（ゲスト）」
//   見本の写真は確定版の見本の絵（仮）のまま
const CARDS = [
  { area: '渋谷', genre: 'イタリアン', name: 'サンプル食堂 渋谷店', rating: '4.2', count: '1,962件', budget: '¥1,000–3,000', station: '渋谷駅 徒歩5分', bg: '#5E4B3C', plate: '#EDE5DA', food: '#C77B52', herb: '#7C8C55', dot: '#8A7563' },
  { area: '恵比寿', genre: '居酒屋', name: 'サンプル酒場 恵比寿店', rating: '4.0', count: '842件', budget: '¥3,000–5,000', station: '恵比寿駅 徒歩3分', bg: '#3F4A3C', plate: '#EDE5DA', food: '#E0B04A', herb: '#C77B52', dot: '#5C6B54' },
];
const LIGHT = '#D9D4CE'; // 見本のカードの補足の文字（確定版のまま）
const POSES = {
  pass: { front: 'translateX(-34px) rotate(-9deg) scale(0.7)', back: 'translateX(10px) rotate(4deg) scale(0.7)' },
  like: { front: 'translateX(34px) rotate(9deg) scale(0.7)', back: 'translateX(-10px) rotate(-4deg) scale(0.7)' },
};

function SampleCard({ c, children }) {
  const dot = (l, t, w, h, bg) => <div style={{ position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: '50%', background: bg }} />;
  return (
    <article style={{ position: 'relative', width: 361, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 32, overflow: 'hidden', background: color.ink }}>
      <div role="img" aria-label="お店の写真の見本" style={{ position: 'relative', height: 300, background: c.bg, overflow: 'hidden' }}>
        {dot(68, 40, 220, 220, c.plate)}
        {dot(108, 80, 140, 140, c.food)}
        {dot(193, 105, 42, 26, c.herb)}
        {dot(133, 161, 28, 18, c.herb)}
        {dot(282, 70, 48, 48, c.dot)}
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', gap: 8 }}>
          {[c.area, c.genre].map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', height: 32, boxSizing: 'border-box', padding: '0 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 16, background: color.white, color: color.ink, fontSize: 13, fontWeight: 700 }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px 18px', color: color.white }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.2 }}>{c.name}</h2>
        <dl style={{ margin: 0, display: 'flex', alignItems: 'flex-end', gap: 22 }}>
          <div>
            <dt style={{ fontSize: 12, fontWeight: 500, color: LIGHT }}>評価</dt>
            <dd style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: font.dela, fontSize: 40, lineHeight: 1 }}>{c.rating}</span>
              <span style={{ fontSize: 12, color: LIGHT }}>{c.count}</span>
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: 12, fontWeight: 500, color: LIGHT }}>予算</dt>
            <dd style={{ margin: '4px 0 0', fontFamily: font.dela, fontSize: 20, lineHeight: 1.2 }}>{c.budget}</dd>
          </div>
        </dl>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: LIGHT }}>
          <span>{c.station}</span>
          <span>·</span>
          <span style={{ fontWeight: 700, color: color.white }}>営業中</span>
        </div>
      </div>
      {children}
    </article>
  );
}

function SampleButtons({ pose }) {
  const ring = `0 0 0 4px ${color.white}`;
  const pass = pose === 'pass';
  const like = pose === 'like';
  const circle = (size, extra) => ({ width: size, height: size, boxSizing: 'border-box', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: ring, transition: 'background 0.3s, box-shadow 0.3s', ...extra });
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, transform: 'scale(0.82)', transformOrigin: 'bottom center', zIndex: 4 }}>
      <span style={circle(64, { border: `${stroke.shape}px solid ${color.ink}`, background: pass ? color.ink : color.white })}>
        <Icon name="close" size={26} color={pass ? color.white : color.ink} />
      </span>
      <span style={circle(48, { border: `${stroke.shape}px solid ${color.ink}`, background: color.white })}>
        <Icon name="undo" size={22} color={color.ink} />
      </span>
      <span style={circle(76, { background: color.accent, boxShadow: like ? `${ring}, 0 0 0 7px ${color.ink}` : ring })}>
        <Icon name="heartFill" size={32} color={color.white} />
      </span>
    </div>
  );
}

export default function LoginStart({ onSignup, onLogin, onGuest, guestBusy }) {
  const [pose, setPose] = useState('pass');
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const t = setInterval(() => setPose((p) => (p === 'pass' ? 'like' : 'pass')), 3000);
    return () => clearInterval(t);
  }, []);
  const P = POSES[pose];
  const move = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <div style={{ padding: 'calc(var(--safe-top) + 28px) 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <img src={LOGO.black} alt="mogu" style={{ display: 'block', width: 115, height: 40, objectFit: 'contain', margin: '0 auto' }} />
        <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: color.sub }}>好みが合うお店を、みんなで見つける（仮）</p>

        <div aria-label="お店を左右にスワイプして選ぶ見本" role="img" className="no-zoom" style={{ position: 'relative', height: 392, marginTop: 14 }}>
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 361, marginLeft: -180.5, transformOrigin: 'top center', transform: P.back, transition: move, zIndex: 1 }}>
            <SampleCard c={CARDS[1]} />
          </div>
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 361, marginLeft: -180.5, transformOrigin: 'top center', transform: P.front, transition: move, zIndex: 2 }}>
            <SampleCard c={CARDS[0]}>
              <SwipeSticker kind={pose} plain />
            </SampleCard>
          </div>
          <SampleButtons pose={pose} />
        </div>

        <button type="button" className="ui-btn ui-btn--primary" onClick={onSignup} style={{ width: '100%', height: 56, marginTop: 18, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
          新規アカウント登録
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onLogin} style={{ width: '100%', height: 56, marginTop: 10, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
          ログイン
        </button>
        <TextLink onClick={guestBusy ? undefined : onGuest} style={{ marginTop: 4 }}>
          登録せずにお試し（ゲスト）
        </TextLink>
      </div>
      <SwipeGlow kind={pose} opacity={1} />
    </div>
  );
}
