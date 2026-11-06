import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { LOGO } from '../../lib/brand';
import { chara, GUIDE } from '../../lib/chara';
import { isEmail, NICKNAME_MAX, validateSignup } from '../../lib/validate';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import LoginStart from './LoginStart';
import HandleField from './HandleField';
import { BackRow, Consent, ErrorBanner, PasswordChecks, TextLink } from './LoginParts';

// ログイン・新規登録（確定版 Final-07 合体案）
//   最初の画面 → ログイン／新規登録／パスワードの再設定（メールを送る → 送りました）
//   ユーザーIDの欄は2回目（1回目は出さない）。Apple や Google のログインは置かない
const page = { position: 'fixed', inset: 0, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink };
const inner = { padding: 'var(--safe-top) 20px 40px', maxWidth: 480, margin: '0 auto' };

function Brand({ marginTop = 12 }) {
  return (
    <>
      <div style={{ marginTop }}>
        <img src={LOGO.black} alt="mogu" style={{ display: 'block', width: 127, height: 44, objectFit: 'contain', margin: '0 auto' }} />
      </div>
      <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: color.sub }}>好みが合うお店を、みんなで見つける（仮）</p>
    </>
  );
}

// ログイン（確定版 Final-07 の 3・11）
export function LoginForm({ initialEmail = '', onBack, onForgot, onSignup, onGuest, guestBusy }) {
  const { login } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBanner('');
    if (!isEmail(email)) {
      setEmailError('メールアドレスの形が違います');
      return;
    }
    setEmailError('');
    if (!password) {
      setBanner('メールアドレスかパスワードが違います');
      return;
    }
    setBusy(true);
    const { error } = await login(email.trim(), password);
    setBusy(false);
    if (error) setBanner(error);
  };

  return (
    <div style={page}>
      <form onSubmit={submit} style={inner} noValidate>
        <BackRow onBack={onBack} />
        <Brand />
        <div style={{ marginTop: 28 }}>
          {banner && (
            <>
              <ErrorBanner>{banner}</ErrorBanner>
              <div style={{ height: 16 }} />
            </>
          )}
          <TextField label="メールアドレス" type="email" inputMode="email" autoComplete="email" value={email} onChange={(v) => { setEmail(v); setEmailError(''); }} error={emailError} />
          <div style={{ height: 16 }} />
          <TextField label="パスワード" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
          <TextLink align="left" onClick={onForgot} style={{ marginTop: 4 }}>
            パスワードを忘れた方
          </TextLink>
          <Button type="submit" variant="primary" disabled={busy} style={{ marginTop: 8 }}>
            ログイン
          </Button>
          <Button variant="secondary" onClick={onGuest} disabled={guestBusy} style={{ marginTop: 12, minHeight: 56, borderRadius: 28 }}>
            登録せずにお試し（ゲスト）
          </Button>
          <TextLink onClick={onSignup} style={{ marginTop: 8 }}>
            {'はじめての方は\u3000新規登録'}
          </TextLink>
        </div>
      </form>
    </div>
  );
}

// 新規登録の上の3体（確定版 Final-07 の 5：アロハコアラ・映えぎつね・シェフベア）
const SIGNUP_TRIO = [
  { code: 'VFGP', w: 50, h: 76 },
  { code: 'VNBP', w: 52, h: 80 },
  { code: 'TFBP', w: 50, h: 76 },
];

export function SignupHeader() {
  return (
    <>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, height: 80 }}>
        {SIGNUP_TRIO.map((c) => (
          <img key={c.code} src={chara(c.code)?.framed} alt="" style={{ display: 'block', width: c.w, height: c.h, objectFit: 'contain', objectPosition: 'center bottom' }} />
        ))}
      </div>
      <div style={{ height: 2, margin: '0 40px', background: color.ink }} />
      <h1 style={{ margin: '14px 0 20px', textAlign: 'center', fontFamily: font.dela, fontSize: 22, fontWeight: 400 }}>新規アカウント登録</h1>
    </>
  );
}

// 新規登録の欄（ゲストの登録でも同じ形を使う）
export function SignupFields({ v, set, errors, onLoginWithEmail }) {
  return (
    <>
      <TextField label="ニックネーム" value={v.nickname} onChange={(x) => set({ nickname: x.slice(0, NICKNAME_MAX) })} maxLength={NICKNAME_MAX} showCount autoComplete="nickname" error={errors.nickname} />
      <div style={{ height: 16 }} />
      <HandleField value={v.handle} onChange={(x) => set({ handle: x })} externalError={errors.handle} />
      <div style={{ height: 16 }} />
      <TextField label="メールアドレス" type="email" inputMode="email" autoComplete="email" value={v.email} onChange={(x) => set({ email: x })} error={errors.email} />
      {errors.emailTaken && onLoginWithEmail && (
        <TextLink align="left" onClick={onLoginWithEmail}>
          このメールアドレスでログインする
        </TextLink>
      )}
      <div style={{ height: 16 }} />
      <TextField label="パスワード" type="password" autoComplete="new-password" value={v.password} onChange={(x) => set({ password: x })} error={errors.password} />
      <PasswordChecks password={v.password} />
      <Consent />
    </>
  );
}


// 新規登録（確定版 Final-07 の 5・6・12）
function SignupForm({ onLogin, onGuest, guestBusy }) {
  const { signup } = useAuth();
  const [v, setV] = useState({ nickname: '', handle: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      Object.keys(patch).forEach((k) => delete n[k]);
      if (patch.email != null) delete n.emailTaken;
      return n;
    });
  };

  const submit = async (e) => {
    e?.preventDefault();
    setBanner('');
    const errs = validateSignup(v);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    const res = await signup(v.email.trim(), v.password, v.nickname.trim(), v.handle.trim().toLowerCase());
    setBusy(false);
    if (res.error) {
      if (res.code === 'email_taken') setErrors({ email: res.error, emailTaken: true });
      else setBanner(res.error);
      return;
    }
    if (res.handleError) setBanner(`${res.handleError}（あとでプロフィールの編集から決められます）`);
    // メールの確認がオンのとき（すぐにはログインしない）
    if (!res.session) setNotice('確認のメールを送りました。メールのリンクを開いてから、ログインしてください');
  };

  return (
    <div style={page}>
      <form onSubmit={submit} style={{ ...inner, paddingTop: 'calc(var(--safe-top) + 12px)' }} noValidate>
        <SignupHeader />
        {banner && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        <SignupFields v={v} set={set} errors={errors} onLoginWithEmail={() => onLogin(v.email.trim())} />
        {notice && (
          <p role="status" style={{ margin: '16px 0 0', padding: '14px 16px', borderRadius: 18, background: color.surface, fontSize: 14, fontWeight: 700, lineHeight: 1.6 }}>
            {notice}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} style={{ marginTop: 16 }}>
          新規アカウント登録
        </Button>
        <Button variant="secondary" onClick={onGuest} disabled={guestBusy} style={{ marginTop: 12, minHeight: 56, borderRadius: 28 }}>
          登録せずにお試し（ゲスト）
        </Button>
        <TextLink onClick={() => onLogin(v.email.trim())} style={{ marginTop: 8 }}>
          {'アカウントをお持ちの方は\u3000ログイン'}
        </TextLink>
      </form>
    </div>
  );
}

// パスワードの再設定（確定版 Final-07 の 9・10）。登録されていないメールアドレスでも同じ「メールを送りました」
function ResetForm({ initialEmail = '', onBack }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const harry = chara(GUIDE.harry);

  const submit = async (e) => {
    e?.preventDefault();
    setBanner('');
    if (!isEmail(email)) {
      setError('メールアドレスの形が違います');
      return;
    }
    setBusy(true);
    const res = await resetPassword(email.trim());
    setBusy(false);
    if (res.error) {
      setBanner(res.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div style={page}>
        <div style={inner}>
          <BackRow onBack={onBack} />
          <h1 className="no-zoom" style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400 }}>パスワードの再設定</h1>
          <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 90 }}>
            <span style={{ width: 96, height: 96, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mail" size={44} />
            </span>
            <h2 className="no-zoom" style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400 }}>メールを送りました</h2>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7 }}>メールのリンクから新しいパスワードを決めてください</p>
          </div>
          <Button variant="primary" onClick={onBack} style={{ marginTop: 32 }}>
            ログインに戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <form onSubmit={submit} style={inner} noValidate>
        <BackRow onBack={onBack} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <img src={harry?.framed} alt="" style={{ display: 'block', width: 84, height: 128, objectFit: 'contain', objectPosition: 'center bottom' }} />
        </div>
        <h1 className="no-zoom" style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400, textAlign: 'center' }}>パスワードの再設定</h1>
        <p style={{ margin: '8px 0 18px', fontSize: 14, lineHeight: 1.7 }}>登録したメールアドレスを入れてください</p>
        {banner && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        <TextField label="メールアドレス" type="email" inputMode="email" autoComplete="email" value={email} onChange={(x) => { setEmail(x); setError(''); }} error={error} />
        <Button type="submit" variant="primary" disabled={busy} style={{ marginTop: 20 }}>
          再設定のメールを送る
        </Button>
      </form>
    </div>
  );
}

export default function LoginFlow() {
  const { guestLogin } = useAuth();
  const [screen, setScreen] = useState('start'); // start | login | signup | reset
  const [email, setEmail] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState('');

  const guest = async () => {
    setGuestBusy(true);
    setGuestError('');
    const { error } = await guestLogin();
    setGuestBusy(false);
    if (error) setGuestError(error);
  };

  let body;
  if (screen === 'login') body = <LoginForm key={email} initialEmail={email} onBack={() => setScreen('start')} onForgot={() => setScreen('reset')} onSignup={() => setScreen('signup')} onGuest={guest} guestBusy={guestBusy} />;
  else if (screen === 'signup')
    body = (
      <SignupForm
        onLogin={(e) => {
          setEmail(e || '');
          setScreen('login');
        }}
        onGuest={guest}
        guestBusy={guestBusy}
      />
    );
  else if (screen === 'reset') body = <ResetForm initialEmail={email} onBack={() => setScreen('login')} />;
  else body = <LoginStart onSignup={() => setScreen('signup')} onLogin={() => setScreen('login')} onGuest={guest} guestBusy={guestBusy} />;

  return (
    <>
      {body}
      {guestError && (
        <div role="alert" style={{ position: 'fixed', left: 16, right: 16, bottom: 34, minHeight: 60, boxSizing: 'border-box', padding: '8px 20px', borderRadius: 30, background: color.ink, color: color.white, display: 'flex', alignItems: 'center', fontFamily: font.plex, fontSize: 14, fontWeight: 700, zIndex: 90 }}>
          {guestError}
        </div>
      )}
    </>
  );
}
