import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { color, stroke } from '../../theme/tokens';
import { handleFormatOk } from '../../lib/validate';
import { checkHandle } from '../../lib/profile';
import BottomSheet from '../../components/ui/BottomSheet';
import Icon from '../../components/ui/Icon';

// ユーザーIDの変更（確定版 Final-04 と同じ6つの状態。④のプロフィール編集と⑤のアカウントの2か所から開く：4回目 §3-4）
export default function HandleEditSheet({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [handle, setHandleInput] = useState(user?.handle || '');
  const [asyncState, setAsyncState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const norm = handle.trim().toLowerCase();
  const needsCheck = norm !== '' && norm !== (user?.handle || '') && handleFormatOk(norm);
  useEffect(() => {
    if (!needsCheck) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await checkHandle(norm);
      setAsyncState({ ...r, forHandle: norm });
    }, 450);
    return () => clearTimeout(timer.current);
  }, [needsCheck, norm]);

  const state = (() => {
    if (norm === (user?.handle || '')) return { status: 'same' };
    if (!norm) return { status: 'empty' };
    if (!handleFormatOk(norm)) return { status: 'format' };
    if (asyncState?.forHandle === norm) return asyncState;
    return { status: 'checking' };
  })();

  const message = {
    same: '', ok: '', empty: '', checking: '',
    taken: 'このIDは使われています',
    format: 'IDは英小文字・数字・_の4〜20文字で、最初は英小文字か数字にしてください',
    reserved: 'このIDは使えません',
    banned: '使えない言葉が含まれています',
    cooldown: 'IDを変えてからまだ2週間たっていません。次に変えられるのは2週間後です',
    rate: '少し待ってから、もう一度お試しください',
    error: '確認できませんでした',
  }[state.status] || '';
  const ok = state.status === 'ok';
  const bad = ['taken', 'format', 'reserved', 'banned', 'cooldown', 'rate', 'error'].includes(state.status);
  const changed = norm !== (user?.handle || '') && ok;

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    setError('');
    const { error: e } = await updateProfile({ handle: norm });
    setSaving(false);
    if (e) {
      setError(e);
      return;
    }
    onClose?.();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="ユーザーIDを変更"
      header={{ left: { label: 'キャンセル', onClick: onClose }, title: 'ユーザーID', right: { label: '保存', onClick: save, disabled: !changed || saving } }}
    >
      <div style={{ padding: '18px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 48, boxSizing: 'border-box', padding: '0 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24 }}>
          <span style={{ flex: '0 0 auto', color: color.sub }}>@</span>
          <input
            value={handle}
            onChange={(e) => setHandleInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
            maxLength={20}
            aria-label="ユーザーID"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 16, color: color.ink }}
          />
          {state.status === 'checking' ? (
            <Icon name="refresh" size={18} color={color.sub} />
          ) : ok && handle.trim() ? (
            <Icon name="check" size={20} color={color.ink} />
          ) : bad ? (
            <Icon name="warning" size={20} color={color.red} />
          ) : null}
        </div>
        {message && <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: bad ? color.red : color.ink }}>{message}</p>}
        {!message && ok && handle.trim() && <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.ink }}>使えます</p>}
        {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      </div>
    </BottomSheet>
  );
}
