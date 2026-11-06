import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';
import { SubPage } from './SettingsParts';

// 設定の中「招待を受け取る範囲」（確定版 f05-11）
//   誰からでも／受け取らない。選ぶとすぐに反映（押したあとに保存ボタンは無い）
//   カードの右上に黒丸のチェック（Radio.jsx の小さい丸とは別の見た目。この画面専用）
function ScopeCard({ selected, title, desc, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="ui-btn ui-press"
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        padding: selected ? '17px 53px 17px 17px' : '18px 54px 18px 18px',
        border: `${selected ? 3 : 2}px solid ${color.ink}`,
        borderRadius: 24,
        background: color.white,
        color: color.ink,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {selected && (
        <span style={{ position: 'absolute', right: 14, top: 14, width: 28, height: 28, borderRadius: '50%', background: color.ink, color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={16} color={color.white} />
        </span>
      )}
      <span style={{ display: 'block', fontFamily: font.dela, fontSize: 18 }}>{title}</span>
      <span style={{ display: 'block', marginTop: 6, fontSize: 13, lineHeight: 1.6, color: color.sub }}>{desc}</span>
    </button>
  );
}

export default function InviteScopeScreen({ onBack }) {
  const { user, updateProfile } = useAuth();
  const [value, setValue] = useState(user?.inviteScope || 'anyone');
  const [busy, setBusy] = useState(false);

  const choose = async (v) => {
    if (v === value || busy) return;
    setValue(v);
    setBusy(true);
    const { error } = await updateProfile({ inviteScope: v });
    setBusy(false);
    if (error) setValue((cur) => (cur === v ? user?.inviteScope || 'anyone' : cur));
  };

  return (
    <SubPage title="招待を受け取る範囲" onBack={onBack}>
      <div role="radiogroup" aria-label="招待を受け取る範囲" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ScopeCard selected={value === 'anyone'} title="誰からでも" desc="IDを知っている人から、グループへの招待が届きます" onClick={() => choose('anyone')} />
        <ScopeCard selected={value === 'none'} title="受け取らない" desc="IDでの招待は届きません。QRコードの交換でグループに入れます" onClick={() => choose('none')} />
      </div>
    </SubPage>
  );
}
