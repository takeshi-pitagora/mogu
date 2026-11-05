import { color, font, stroke } from '../../theme/tokens';
import Avatar from './Avatar';

// メンバーの写真を重ねて並べる（確定版 Final-08：上部は26・重なり8、シートの行は34・重なり11。白いふち2）
// 4人を超えるときは「+3」の丸（確定版 Final-08 の探し方のシート）
export default function AvatarStack({ members = [], size = 26, max = 4 }) {
  const overlap = size >= 34 ? 11 : 8;
  const shown = members.length > max ? members.slice(0, max - 1) : members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <span key={m.id || i} style={{ position: 'relative', display: 'block', flex: 'none', marginLeft: i === 0 ? 0 : -overlap, borderRadius: '50%', boxShadow: `0 0 0 2px ${color.white}`, zIndex: max - i }}>
          <Avatar size={size} name={m.display_name || m.name} photoUrl={m.avatar_url || null} />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{
            position: 'relative',
            flex: 'none',
            marginLeft: -overlap,
            width: size,
            height: size,
            boxSizing: 'border-box',
            border: `${stroke.shape}px solid ${color.ink}`,
            borderRadius: '50%',
            background: color.surface,
            boxShadow: `0 0 0 2px ${color.white}`,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.plex,
            fontSize: 12,
            fontWeight: 700,
            color: color.ink,
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
