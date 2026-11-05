import { color, stroke } from '../../theme/tokens';
import AvatarStack from './AvatarStack';
import { groupRowStyle } from './styles';

// 丸い選択（24・2ptの線、選ばれると中に10の黒丸）。確定版 Final-08・Final-09 のシートのまま
export function Radio({ on }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', flex: 'none', width: 24, height: 24, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%' }}>
      {on && <span style={{ position: 'absolute', left: 5, top: 5, width: 10, height: 10, borderRadius: '50%', background: color.ink }} />}
    </span>
  );
}

// 押せない丸（点線・薄い線）：Coming Soon の行
export function RadioDisabled() {
  return <span aria-hidden="true" style={{ flex: 'none', width: 24, height: 24, boxSizing: 'border-box', border: `${stroke.shape}px dashed ${color.lineStrong}`, borderRadius: '50%' }} />;
}

// グループを選ぶ行（左104の列にメンバーの写真の丸34、名前16・人数12、右に丸い選択）
//   確定版 Final-08「探し方」・Final-09「グループに送る」の行
export function GroupRadioRow({ group, on, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} style={groupRowStyle}>
      <span style={{ flex: 'none', width: 104, display: 'flex', alignItems: 'center' }}>
        <AvatarStack members={group.members} size={34} total={group.count} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</span>
        {group.count != null && <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 500, color: color.sub }}>{group.count}人</span>}
      </span>
      <Radio on={on} />
    </button>
  );
}
