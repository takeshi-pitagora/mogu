import { color, font } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import { actionLabel } from '../../lib/notebook';
import { CoinStamp, Num } from './NotebookParts';

// =============================================================
// ㉖-4・⑳-11/12 コインの取り消しの理由
//   ［記録］の取り消しの行と、⑩の「コインの取り消し」の知らせから
// =============================================================

export default function CoinReasonSheet({ row, onClose }) {
  if (!row) return null;
  return (
    <BottomSheet open onClose={onClose} ariaLabel="コインの取り消し">
      <h2 style={{ margin: '14px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>コインの取り消し</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <CoinStamp state="cancelled" />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{actionLabel(row.action, row.amount)}</span>
        <Num size={18} muted strike>−{Math.abs(row.amount)}</Num>
      </div>
      {row.shop_name && <div style={{ marginTop: 4, fontSize: 13, color: color.sub }}>{row.shop_name}</div>}
      <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.7 }}>{row.reason || '運営が確かめたうえで取り消しました'}</p>
      <button type="button" className="ui-btn ui-btn--primary" onClick={onClose} style={{ width: '100%', height: 56, marginTop: 20, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
        閉じる
      </button>
    </BottomSheet>
  );
}
