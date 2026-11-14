import { color, groupColor, groupOf, stroke } from '../../theme/tokens';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import TypeLabel from './TypeLabel';

// パス（タイプのコードを縦に積み、キャラの全身を右に大きく）。
// ③④⑥⑩⑪⑬で共通に使う部品（4回目：⑪の「相手を確かめる」で使うため共通コンポーネント化）
export default function MoguTypeCard({ code, characterName, nickname, imageUrl, style }) {
  const type = getType(code);
  const g = type ? groupColor[groupOf(type.code)] : null;
  const ch = !imageUrl && type ? chara(type.code) : null;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 280,
        padding: '18px 16px',
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 24,
        background: g ? g.light : color.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ display: 'block', width: 140, height: 210, objectFit: 'contain', objectPosition: 'center bottom' }} />
      ) : (
        ch && <img src={ch.framed} alt="" style={{ display: 'block', width: 140, height: 210, objectFit: 'contain', objectPosition: 'center bottom' }} />
      )}
      <div style={{ marginTop: 8 }}>{type && <TypeLabel code={type.code} />}</div>
      {!type && characterName && <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{characterName}</p>}
      {nickname && <p style={{ margin: '4px 0 0', fontSize: 13, color: color.sub }}>{nickname}さんの結果</p>}
    </div>
  );
}
