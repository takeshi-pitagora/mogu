import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { getType, TYPES } from '../../lib/mogutype';
import { chara } from '../../lib/chara';

// ⑥のパス（確定版 Final-06 の「案1 ビッグコードの改善C」）。⑩の「招待した人」と⑪の「相手を確かめる」でも同じ部品を使う
//   353×220・ふち2pt・角24、地はグループの濃い色
//   タイプのコードを左の端に縦に積む（Dela 50・字間 -6・グループの淡い色）
//   キャラ名は2行（1行目は淡い色の白抜き、2行目は白）、その下にニックネーム ・ 診断した日
//   キャラの全身は右に大きく（150×229・下に -10 はみ出す）
//   パスの No. は出さない（修正指示書 §4-2：サイトに番号がないため）
const W = 353;
const H = 220;

const formatDot = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
};

export default function MoguTypeCard({ code, characterName, nickname, completedAt, imageUrl, style }) {
  const type = getType(code);
  const g = type ? groupColor[groupOf(type.code)] : null;
  const light = g ? g.light : color.surface;
  const dark = g ? g.dark : color.sub;
  const img = imageUrl || (type ? chara(type.code)?.framed : null);
  const name = characterName || type?.name || '';
  const lines = (type && TYPES[type.code]?.nameLines) || splitName(name);
  const date = formatDot(completedAt);
  const caption = [nickname, date].filter(Boolean).join(' ・ ');

  return (
    <div
      role="img"
      aria-label={`パス ${type?.code || ''} ${name}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: W,
        aspectRatio: `${W} / ${H}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 24,
        background: dark,
        color: color.white,
        ...style,
      }}
    >
      {type && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: font.dela,
            fontSize: 50,
            lineHeight: 1,
            letterSpacing: -6,
            color: light,
          }}
        >
          {type.code}
        </span>
      )}
      <div aria-label={name} style={{ position: 'absolute', left: 82, top: 58, whiteSpace: 'nowrap' }}>
        <div aria-hidden="true" style={{ fontFamily: font.dela, fontSize: 25, lineHeight: 1.1, color: 'transparent', WebkitTextStroke: `1.2px ${light}` }}>
          {lines[0]}
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', left: 12, top: 28, fontFamily: font.dela, fontSize: 23, lineHeight: 1.2 }}>
          {lines[1]}
        </div>
      </div>
      {caption && <div style={{ position: 'absolute', left: 82, bottom: 16, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{caption}</div>}
      {img && <img src={img} alt="" style={{ position: 'absolute', right: 2, bottom: -10, width: 150, height: 229, objectFit: 'contain', objectPosition: 'center bottom' }} />}
    </div>
  );
}

// nameLines を持たない名前（APIから来た知らないキャラ名など）のときだけ使う、おおまかな区切り
function splitName(name) {
  const s = String(name || '');
  if (s.length <= 1) return [s, ''];
  const at = Math.ceil(s.length / 2);
  return [s.slice(0, at), s.slice(at)];
}
