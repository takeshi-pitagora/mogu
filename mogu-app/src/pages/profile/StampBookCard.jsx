import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import VisitStamp from '../../components/ui/VisitStamp';
import { PER_SHEET, dotDate, myStamps, sheetsOf } from '../../lib/stampBook';

// =============================================================
// ③スタンプ帳-1・6 プロフィールの入口のカード
//   高さ72・2ptの線・角丸22・白。「スタンプ帳」と「24個・3枚目の台紙 6/9」、
//   新しいスタンプ2つ（40・間8・重ねない）、右に矢印。カード全体を押すとスタンプ帳
// =============================================================

export default function StampBookCard({ onOpen }) {
  const [list, setList] = useState(null);

  useEffect(() => {
    let alive = true;
    myStamps()
      .then((rows) => alive && setList(rows))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);

  if (list === null) return null;

  const sheets = sheetsOf(list);
  const n = list.length;
  const lastSheet = sheets[sheets.length - 1];
  const sub = n === 0 ? '0個' : `${n}個・${sheets.length}枚目の台紙 ${lastSheet.length}/${PER_SHEET}`;
  const latest = list.slice(-2).reverse(); // 新しいスタンプ2つ

  return (
    <button
      type="button"
      className="ui-btn"
      onClick={onOpen}
      aria-label={`スタンプ帳 ${sub}`}
      style={{ width: '100%', marginTop: 14, minHeight: 72, boxSizing: 'border-box', padding: '10px 6px 10px 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: color.white, color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: font.dela, fontSize: 17 }}>スタンプ帳</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>{sub}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {latest.map((s) => (
          <VisitStamp key={s.id} code={s.stamp_character} name={s.shop_name} date={dotDate(s.visited_on)} size={40} tilt={-5} />
        ))}
        <Icon name="chevronRight" size={22} />
      </span>
    </button>
  );
}
