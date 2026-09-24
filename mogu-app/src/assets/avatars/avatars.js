import avatar01 from './avatar-01.png';
import avatar02 from './avatar-02.png';
import avatar03 from './avatar-03.png';
import avatar04 from './avatar-04.png';
import avatar05 from './avatar-05.png';
import avatar06 from './avatar-06.png';
import avatar07 from './avatar-07.png';
import avatar08 from './avatar-08.png';
import avatar09 from './avatar-09.png';
import avatar10 from './avatar-10.png';
import avatar11 from './avatar-11.png';
import avatar12 from './avatar-12.png';
import avatar13 from './avatar-13.png';
import avatar14 from './avatar-14.png';
import avatar15 from './avatar-15.png';
import avatar16 from './avatar-16.png';

// draft.avatar / user.avatar には、ここで定義する id（例: "avatar-01"）を文字列として保存する。
// 既存ユーザーの絵文字（🍓など）が入っている場合はここに一致しないため、
// getAvatarSrc は null を返し、呼び出し側で絵文字表示にフォールバックする。
export const AVATARS = [
  { id: 'avatar-01', src: avatar01 },
  { id: 'avatar-02', src: avatar02 },
  { id: 'avatar-03', src: avatar03 },
  { id: 'avatar-04', src: avatar04 },
  { id: 'avatar-05', src: avatar05 },
  { id: 'avatar-06', src: avatar06 },
  { id: 'avatar-07', src: avatar07 },
  { id: 'avatar-08', src: avatar08 },
  { id: 'avatar-09', src: avatar09 },
  { id: 'avatar-10', src: avatar10 },
  { id: 'avatar-11', src: avatar11 },
  { id: 'avatar-12', src: avatar12 },
  { id: 'avatar-13', src: avatar13 },
  { id: 'avatar-14', src: avatar14 },
  { id: 'avatar-15', src: avatar15 },
  { id: 'avatar-16', src: avatar16 },
];

export function getAvatarSrc(avatarId) {
  const found = AVATARS.find((a) => a.id === avatarId);
  return found ? found.src : null;
}