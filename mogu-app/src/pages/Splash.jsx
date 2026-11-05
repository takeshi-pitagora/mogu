import { useEffect, useState } from 'react';
import { color } from '../theme/tokens';
import { NOZOKU_LOGO } from '../lib/brand';

// 起動画面と同じ見た目の最初の画面（確定版 Final-12「動き（0.4秒）」）
//   白い地のまん中に、のぞくロゴ（幅270・高さ111.5）。
//   ロゴの画像はそのまま使い、「mogu の文字」（左 182.9）と「ハリー」（右 87.1）の2枚に切って重ねる。
//   ハリーの側だけ、足もとを軸に translateX(-6px) rotate(-7deg) へ約0.4秒でのぞきこむ → ホームへ
const W = 270;
const H = 111.5;
const TEXT_W = 182.9;
const HARRY_W = W - TEXT_W;
const PEEK_MS = 400;
const REST_MS = 150; // iOS の起動画面からつながって見えるよう、少し止まってから動かす
const OUT_MS = 200;

export default function Splash({ ready, onDone }) {
  const [phase, setPhase] = useState('rest'); // rest → peek → peeked（ログインの確認が終わっていれば消える）

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('peek'), REST_MS);
    const t2 = setTimeout(() => setPhase((p) => (p === 'peek' ? 'peeked' : p)), REST_MS + PEEK_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const out = phase === 'peeked' && ready;
  useEffect(() => {
    if (!out) return undefined;
    const t = setTimeout(() => onDone?.(), OUT_MS);
    return () => clearTimeout(t);
  }, [out, onDone]);

  const peek = phase !== 'rest';
  const img = <img src={NOZOKU_LOGO.black} alt="" draggable={false} style={{ display: 'block', width: W, height: H }} />;

  return (
    <div
      role="img"
      aria-label="mogu"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: color.bg, opacity: out ? 0 : 1, transition: `opacity ${OUT_MS}ms ease-out`, pointerEvents: out ? 'none' : 'auto' }}
    >
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: TEXT_W, height: H, overflow: 'hidden', zIndex: 3 }}>{img}</div>
        <div
          style={{
            position: 'absolute',
            left: TEXT_W,
            top: 0,
            width: HARRY_W,
            height: H,
            overflow: 'hidden',
            zIndex: 4,
            transformOrigin: '50% 100%',
            transform: peek ? 'translateX(-6px) rotate(-7deg)' : 'none',
            transition: `transform ${PEEK_MS}ms ease-in-out`,
          }}
        >
          <div style={{ marginLeft: -TEXT_W }}>{img}</div>
        </div>
      </div>
    </div>
  );
}
