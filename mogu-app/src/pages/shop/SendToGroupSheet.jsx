import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import SheetBar from '../../components/ui/SheetBar';
import { GroupRadioRow } from '../../components/ui/Radio';
import { budgetLabel, genreLabel, shopPhotos } from '../../lib/shop';

// シート「グループに送る」（確定版 Final-09 の 11）
//   上の段：［キャンセル］「グループに送る」［送る］。お店の小さな情報（クリームの箱）、参加中のグループの一覧から1つ選ぶ
export default function SendToGroupSheet({ open, shop, groups = [], onClose, onSend }) {
  const [picked, setPicked] = useState(null);
  const [sending, setSending] = useState(false);
  if (!open || !shop) return null;
  const photo = shopPhotos(shop)[0];
  const place = [shop.area, genreLabel(shop)].filter(Boolean).join('・');
  const budget = budgetLabel(shop.price_level);
  const sub = [place, budget].filter(Boolean).join(' ・ ');

  const send = async () => {
    const g = groups.find((x) => x.id === picked);
    if (!g || sending) return;
    setSending(true);
    try {
      await onSend?.(g);
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose} ariaLabel="グループに送る">
      <SheetBar title="グループに送る" onCancel={onClose} actionLabel="送る" onAction={send} actionDisabled={!picked || sending} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, background: color.surface, flex: 'none' }}>
        <div style={{ position: 'relative', flex: 'none', width: 48, height: 48, borderRadius: 14, overflow: 'hidden', background: color.ink }}>
          {photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.name}</div>
          {sub && <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: color.sub, fontFamily: font.plex }}>{sub}</div>}
        </div>
      </div>
      <div role="radiogroup" aria-label="送るグループ" style={{ marginTop: 8, overflowY: 'auto', minHeight: 0 }}>
        {groups.map((g) => (
          <GroupRadioRow key={g.id} group={g} on={picked === g.id} onClick={() => setPicked(g.id)} />
        ))}
      </div>
    </BottomSheet>
  );
}
