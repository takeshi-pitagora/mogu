import { color, font, paper } from '../../theme/tokens';
import Dig from '../../components/ui/Dig';
import { Coin, Num, Tape } from './NotebookParts';

// =============================================================
// ㉖-2 表紙のラベル
//   黒い革（内側に白の点線のステッチ）の上にベージュのラベル。
//   「◯◯の探検手帳」と始めた月、dig、コインと仮、
//   「dig◯ まで あと ◯ いいね」と定規（10ごとに長い線・たまった分は斜めの線）
// =============================================================

export default function NotebookCover({ name, since, dig, coins, pending, likes, at, nextAt, children }) {
  const span = Math.max(1, nextAt - at);
  const done = Math.max(0, Math.min(1, (likes - at) / span));
  const pct = `${Math.round(done * 1000) / 10}%`;
  const left = Math.max(0, nextAt - likes);

  return (
    <div style={{ position: 'relative', marginTop: 4, padding: '12px 32px 16px 8px', borderRadius: 22, backgroundColor: color.ink, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1.3px)', backgroundSize: '5px 5px' }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 5, border: '1.5px dashed rgba(255,255,255,0.2)', borderRadius: 18, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', margin: '0 -24px 14px 0' }}>
        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: 12, background: paper.page }}>
          <span aria-hidden="true" style={{ position: 'absolute', inset: 5, border: `1px solid ${color.ink}`, borderRadius: 8, pointerEvents: 'none' }} />
          <Tape style={{ position: 'absolute', right: -16, top: 6, zIndex: 3 }} />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: font.mincho, fontWeight: 800, fontSize: 13, color: color.ink, letterSpacing: '0.1em' }}>{name}の探検手帳</span>
            {since && <Num size={12} muted weight={600}>{since} —</Num>}
          </div>
          <div style={{ marginTop: 8, borderTop: '1px solid #D6C6AA' }} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
            <Dig n={dig} size={34.4} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span aria-label={`モグコイン ${coins}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', color: color.ink }}>
                  <Coin size={26} />
                  <span style={{ fontFamily: font.dela, fontSize: 24, lineHeight: 1 }}>{coins}</span>
                </span>
              </div>
              {pending > 0 && (
                <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 11, fontWeight: 700, color: color.sub }}>
                  <Coin size={14} state="pending" />
                  仮 {pending}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '14px 0 6px' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12, fontWeight: 700 }}>
              <Dig n={dig + 1} size={10.3} />
              まで
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12, fontWeight: 700 }}>
              あと<Num size={18}>{left}</Num>いいね
            </span>
          </div>

          {/* 定規。2% ごとに短い線・10% ごとに長い線 */}
          <div style={{ position: 'relative', height: 22, boxSizing: 'border-box', border: `1.5px solid ${color.ink}`, borderRadius: 4, background: '#FFFDF8', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct, background: 'repeating-linear-gradient(-45deg, #C08268 0 5px, #CC977F 5px 10px)' }} />
            <span aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(90deg, ${color.ink} 1px, transparent 1px), linear-gradient(90deg, ${color.ink} 1px, transparent 1px)`, backgroundSize: '10% 7px, 2% 4px', backgroundRepeat: 'repeat-x', backgroundPosition: '-1px 0, -1px 0' }} />
          </div>
          <div style={{ position: 'relative', height: 18 }}>
            <span style={{ position: 'absolute', left: pct, top: 2, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `6px solid ${color.ink}` }} />
            </span>
            <span style={{ position: 'absolute', left: 0, top: 5 }}><Num size={11} muted weight={600}>{at}</Num></span>
            <span style={{ position: 'absolute', right: 0, top: 5 }}><Num size={11} muted weight={600}>{nextAt}</Num></span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
