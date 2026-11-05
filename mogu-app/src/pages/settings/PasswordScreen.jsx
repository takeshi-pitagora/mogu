import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import { PasswordChecks } from '../login/LoginParts';
import { SubPage } from './SettingsParts';

// パスワードの変更（確定版 Final-05 の 7）
//   今のパスワード、新しいパスワード、条件のチェック（8文字以上・英字と数字をどちらも入れる。条件は仮）。条件を満たすと［変更する］が押せる
export default function PasswordScreen({ onBack }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const rules = [
    { label: '8文字以上', ok: next.length >= 8 },
    { label: '英字と数字をどちらも入れる', ok: /[A-Za-z]/.test(next) && /[0-9]/.test(next) },
  ];
  const ready = current.length > 0 && rules.every((r) => r.ok) && !busy;

  const submit = async (e) => {
    e?.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErrors({});
    const res = await changePassword(current, next);
    setBusy(false);
    if (res.error) {
      setErrors(res.field === 'current' ? { current: res.error } : { next: res.error });
      return;
    }
    toast?.show('パスワードを変更しました');
    onBack?.();
  };

  return (
    <SubPage title="パスワードの変更" onBack={onBack}>
      <form onSubmit={submit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TextField label="今のパスワード" type="password" autoComplete="current-password" value={current} onChange={(v) => { setCurrent(v); setErrors({}); }} error={errors.current} />
          <TextField label="新しいパスワード" type="password" autoComplete="new-password" value={next} onChange={(v) => { setNext(v); setErrors({}); }} error={errors.next} />
        </div>
        <PasswordChecks rules={rules} size="settings" />
        <Button type="submit" variant="primary" disabled={!ready} style={{ marginTop: 24 }}>
          変更する
        </Button>
      </form>
    </SubPage>
  );
}
