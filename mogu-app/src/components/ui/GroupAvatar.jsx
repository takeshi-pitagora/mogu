import { color, stroke } from '../../theme/tokens';
import Avatar from './Avatar';

// グループの丸（確定版 Final-11）：2ptの黒いふちの丸を4つに分け、メンバーの写真の丸を1人ずつ入れる
//   56（一覧）・52（詳細の上）・64（参加の確認）。4人より少ないときは、はじめの人からくり返す
export default function GroupAvatar({ members = [], size = 56 }) {
  const half = size / 2;
  const list = members.length > 0 ? members : [{}];
  const four = [0, 1, 2, 3].map((i) => list[i % list.length]);
  return (
    <span aria-hidden="true" style={{ position: 'relative', flex: 'none', display: 'block', width: size, height: size, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', overflow: 'hidden', background: color.surface }}>
      {four.map((m, i) => (
        <span key={i} style={{ position: 'absolute', left: (i % 2) * half, top: Math.floor(i / 2) * half, width: half, height: half, overflow: 'hidden' }}>
          <span style={{ display: 'block', margin: -2 }}>
            <Avatar size={half + 4} name={m.display_name || m.name} photoUrl={m.avatar_url || null} />
          </span>
        </span>
      ))}
    </span>
  );
}
