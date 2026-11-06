import { useEffect, useState } from 'react';
import { color } from '../../theme/tokens';
import { blockUser, listBlocked, photoUrlOf, unblockUser } from '../../lib/profile';
import { useToast } from '../../components/ui/Toast';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { SubPage } from './SettingsParts';

// 設定の中「ブロックしたユーザー」（確定版 f05-12・f05-13：一覧／だれもいないとき）
//   行の右に［解除］。解除すると一覧から消え、下に「元に戻す」付きの知らせ
export default function BlockedUsersScreen({ onBack, onCountChange }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    listBlocked().then((r) => {
      if (!active) return;
      setRows(r.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const release = async (row) => {
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    onCountChange?.((n) => Math.max(0, (n ?? rows.length) - 1));
    const { error } = await unblockUser(row.id);
    if (error) {
      setRows((rs) => [row, ...rs]);
      toast?.show(error);
      return;
    }
    toast?.show('ブロックを解除しました', {
      undo: async () => {
        const res = await blockUser(row.id);
        if (!res.error) setRows((rs) => [row, ...rs]);
      },
    });
  };

  return (
    <SubPage title="ブロックしたユーザー" onBack={onBack}>
      {!loading && rows.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 120 }}>
          <span style={{ width: 88, height: 88, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="block" size={40} color={color.sub} />
          </span>
          <p style={{ margin: '18px 0 0', fontSize: 16, fontWeight: 700 }}>ブロックしている人はいません</p>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ borderTop: `2px solid ${color.ink}`, borderBottom: `2px solid ${color.ink}` }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 68, borderTop: i === 0 ? 0 : `1px solid ${color.line}` }}>
              <Avatar size={44} photoUrl={photoUrlOf(r.avatar_path)} name={r.display_name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.display_name}</span>
                {r.handle && <span style={{ fontSize: 12, color: color.sub }}>@{r.handle}</span>}
              </span>
              <Button variant="small" onClick={() => release(r)} style={{ margin: '4px 0' }}>
                解除
              </Button>
            </div>
          ))}
        </div>
      )}
    </SubPage>
  );
}
