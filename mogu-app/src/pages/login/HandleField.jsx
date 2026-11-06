import { useEffect, useRef, useState } from 'react';
import { handleFormatOk } from '../../lib/validate';
import { checkHandle } from '../../lib/profile';
import TextField from '../../components/ui/TextField';

// 新規登録・「IDを決めよう」で使う、ユーザーIDの欄（確定版 Final-07）
//   英小文字・数字・_ の4〜20文字。入力が止まってからサーバーに確かめる（check_handle）
export default function HandleField({ value, onChange, label = 'ユーザーID', style, initialHandle = '', externalError = '' }) {
  const [asyncState, setAsyncState] = useState(null); // サーバーに確かめた結果（{ status, forHandle }）
  const timer = useRef(null);
  const norm = String(value || '').trim().toLowerCase();
  const needsCheck = !!norm && norm !== initialHandle && handleFormatOk(norm);

  useEffect(() => {
    if (!needsCheck) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await checkHandle(norm);
      setAsyncState({ ...r, forHandle: norm });
    }, 450);
    return () => clearTimeout(timer.current);
  }, [needsCheck, norm]);

  const status = (() => {
    if (!norm) return null;
    if (norm === initialHandle) return 'ok';
    if (!handleFormatOk(norm)) return 'format';
    if (asyncState?.forHandle === norm) return asyncState.status;
    return 'checking';
  })();

  const messages = {
    ok: '使えます',
    same: '使えます',
    taken: 'このIDは使われています',
    format: 'IDは英小文字・数字・_の4〜20文字で、最初は英小文字か数字にしてください',
    reserved: 'このIDは使えません',
    banned: '使えない言葉が含まれています',
    cooldown: 'IDを変えてからまだ2週間たっていません',
    rate: '少し待ってから、もう一度お試しください',
    error: '確認できませんでした',
  };
  const isError = status && !['ok', 'same', 'checking'].includes(status);

  return (
    <TextField
      label={label}
      prefix="@"
      value={value}
      onChange={(v) => onChange(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
      autoComplete="username"
      error={isError ? messages[status] : !norm ? externalError : ''}
      hint={!isError && status && status !== 'checking' ? messages[status] : ''}
      loading={status === 'checking'}
      success={status === 'ok' || status === 'same'}
      style={style}
    />
  );
}
