import { color, font, groupColor, groupOf } from '../../theme/tokens';
import { getType } from '../../lib/mogutype';

// §4-9 タイプのラベル
//   2行：上にコード（Dela 12・グループの濃い色。例 VNBP）、下に名前（14pt 太字・黒。例 映えぎつね）
//   キャラの下ではまん中そろえ、行の中では左そろえ。日付を添えるときは名前の下に 12pt の灰色
export default function TypeLabel({ code, align = 'center', date }) {
  const t = getType(code);
  if (!t) return null;
  const g = groupOf(t.code);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align }}>
      <span style={{ fontFamily: font.dela, fontSize: 12, lineHeight: 1.2, color: g ? groupColor[g].dark : color.ink }}>{t.code}</span>
      <span style={{ fontFamily: font.plex, fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: color.ink }}>{t.name}</span>
      {date && <span style={{ fontFamily: font.plex, fontSize: 12, color: color.sub }}>{date}</span>}
    </div>
  );
}
