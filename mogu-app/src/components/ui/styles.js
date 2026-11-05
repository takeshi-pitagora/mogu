import { color } from '../../theme/tokens';

// グループを選ぶ行の形（確定版 Final-08「探し方」・Final-09「グループに送る」）
export const groupRowStyle = {
  width: '100%',
  minHeight: 72,
  padding: 0,
  border: 0,
  borderBottom: `1px solid ${color.line}`,
  background: 'transparent',
  color: color.ink,
  fontFamily: 'inherit',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};

