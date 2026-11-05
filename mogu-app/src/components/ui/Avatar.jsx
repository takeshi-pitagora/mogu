import { color, font, stroke } from '../../theme/tokens';
import Icon from './Icon';

// §4-8 写真の丸（どの丸も 2pt の黒い線）
//   大きさ：96 プロフィール編集 / 56 1人を大きく / 40 一覧の行 / 32 重ねて並べる（白いふち2） / 26 下のタブと上の帯
//   写真がない人：ニックネームの1文字目を、クリームの丸に Dela（丸の大きさの4割）
//   ブロック中の人：何も出さないクリームの丸。ゲスト：人の形の入った丸
export default function Avatar({ size = 40, photoUrl, name, blocked = false, guest = false, ring = false, label }) {
  const box = {
    position: 'relative',
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    boxSizing: 'border-box',
    border: `${stroke.shape}px solid ${color.ink}`,
    borderRadius: '50%',
    overflow: 'hidden',
    background: color.surface,
    boxShadow: ring ? `0 0 0 2px ${color.white}` : undefined,
  };

  if (guest) {
    // 確定版 Final-14 のゲストの丸（中の人の形は 16/26 の大きさ・線 2.4）
    return (
      <span role="img" aria-label={label || 'ゲスト'} style={box}>
        <Icon name="personGuest" size={Math.round(size * (16 / 26))} strokeWidth={2.4} color={color.ink} />
      </span>
    );
  }
  if (blocked) {
    return <span role="img" aria-label={label || 'ブロック中のユーザー'} style={box} />;
  }
  if (photoUrl) {
    return (
      <span style={box}>
        <img src={photoUrl} alt={label || name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    );
  }
  const initial = Array.from(String(name || '').trim())[0] || '';
  return (
    <span role="img" aria-label={label || name || ''} style={box}>
      <span aria-hidden="true" style={{ fontFamily: font.dela, fontSize: Math.round(size * 0.4), lineHeight: 1, color: color.ink }}>
        {initial}
      </span>
    </span>
  );
}
