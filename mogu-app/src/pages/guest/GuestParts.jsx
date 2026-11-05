import { useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { GUIDE } from '../../lib/chara';
import { LOGO } from '../../lib/brand';
import { validateSignup } from '../../lib/validate';
import BottomSheet from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import AvatarStack from '../../components/ui/AvatarStack';
import { TitleHeader } from '../../components/ui/ScreenHeader';
import { SignupFields, SignupHeader, LoginForm } from '../login/LoginFlow';
import { ErrorBanner, TextLink } from '../login/LoginParts';

// ゲストのときの画面（確定版 Final-14 体験見本型）
//   使えない機能を押したときだけ登録の案内を出す。自動で何度も出さない。ゲストを責める言い方はしない

// 「探し方」のシートの見本のグループ「mogu部」（見本の印・うすく表示・押しても開かない）と［アカウントを登録する］
const SAMPLE_MEMBERS = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
export function GuestSampleGroupRow({ onRegister }) {
  return (
    <>
      <div aria-label="見本のグループ mogu部（登録すると使えます）" style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 72, borderBottom: `1px solid ${color.line}`, opacity: 0.55 }}>
        <span style={{ flex: 'none', width: 104, display: 'flex' }}>
          <AvatarStack members={SAMPLE_MEMBERS} size={34} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>mogu部</span>
          <span style={{ display: 'block', fontSize: 12, color: color.sub }}>4人</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, boxSizing: 'border-box', padding: '0 10px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 13, background: color.white, color: color.ink, fontSize: 12, fontWeight: 700 }}>見本</span>
      </div>
      <Button variant="primary" onClick={onRegister} style={{ marginTop: 16 }}>
        アカウントを登録する
      </Button>
    </>
  );
}

// 登録の案内（確定版 Final-14 の 4）：右上のふちに映えぎつね
export function GuestRegisterSheet({ open, onClose, onRegister }) {
  return (
    <BottomSheet open={open} onClose={onClose} charaCode={GUIDE.kitsune} height={372} ariaLabel="登録すると使えます">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, paddingRight: 76 }}>
        <Icon name="personAdd" size={26} />
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400 }}>登録すると使えます</h2>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7 }}>グループを作る・参加する、IDでの招待は、アカウントを登録すると使えます。</p>
      <p style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 16, background: color.surface, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>ゲストで保存したお店は、登録後もそのまま残ります</p>
      <Button variant="primary" onClick={onRegister} style={{ marginTop: 18 }}>
        アカウントを登録する
      </Button>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 10 }}>
        あとで
      </Button>
    </BottomSheet>
  );
}

// グループのタブ（確定版 Final-14 の 3）：右上の＋は登録の案内を開く
export function GuestGroupLocked({ onRegister, onLocked, locked = false }) {
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <TitleHeader title="グループ" actions={[]} />
      {/* ＋（登録の案内を開いている間は黒い丸。確定版 Final-14 の 4） */}
      <button
        type="button"
        aria-label="グループを作る・コードで参加"
        onClick={onLocked}
        className="ui-btn"
        style={{ position: 'absolute', right: 8, top: 'calc(var(--safe-top) + 5px)', width: 44, height: 44, border: 0, padding: 0, borderRadius: '50%', background: locked ? color.ink : 'transparent', color: locked ? color.white : color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="plusLarge" size={24} />
      </button>
      <div style={{ padding: '100px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.45 }}>
          友達とスワイプして、
          <br />
          行きたいお店を決める
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: color.sub }}>グループは、アカウントを登録すると使えます</p>
        <Button variant="primary" onClick={onRegister} style={{ marginTop: 24 }}>
          アカウントを登録する
        </Button>
      </div>
    </div>
  );
}

// プロフィールのタブ（確定版 Final-14 の 6）：人の形の丸の右に「ゲスト」、［アカウントを登録する］だけ。右上の歯車はゲストの設定へ
export function GuestProfile({ onRegister, onOpenSettings }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <header style={{ paddingTop: 'var(--safe-top)' }}>
        <div style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ width: 44 }} />
          <button type="button" aria-label="設定" onClick={onOpenSettings} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gear" size={24} />
          </button>
        </div>
      </header>
      <div style={{ padding: '12px 20px 130px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span role="img" aria-label="ゲスト" style={{ flex: 'none', display: 'flex', width: 56, height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', background: color.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="personGuest" size={35} />
          </span>
          <h1 className="no-zoom" style={{ margin: 0, fontFamily: font.dela, fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>ゲスト</h1>
        </div>
        <Button variant="primary" onClick={onRegister} style={{ marginTop: 24 }}>
          アカウントを登録する
        </Button>
      </div>
    </div>
  );
}

// ゲストのまま登録（確定版 Final-14 の 8：新規登録と同じ形）。同じ利用者にメールとパスワードを付けるので、保存したお店は残る
//   ［登録せずにお試し（ゲスト）］は登録をやめてゲストのまま戻る。「ログイン」は今あるアカウントでログインし直す
export function GuestSignupScreen({ onClose, onDone }) {
  const { convertGuest } = useAuth();
  const [v, setV] = useState({ nickname: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const set = (patch) => {
    setV((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      Object.keys(patch).forEach((k) => delete n[k]);
      if (patch.email != null) delete n.emailTaken;
      return n;
    });
  };

  if (login) {
    return <LoginForm initialEmail={v.email} onBack={() => setLogin(false)} onForgot={() => setLogin(false)} onSignup={() => setLogin(false)} onGuest={onClose} />;
  }

  const submit = async (e) => {
    e?.preventDefault();
    setBanner('');
    const errs = validateSignup(v);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    const res = await convertGuest({ email: v.email.trim(), password: v.password, displayName: v.nickname.trim() });
    setBusy(false);
    if (res.error) {
      if (res.code === 'email_taken') setErrors({ email: res.error, emailTaken: true });
      else setBanner(res.error);
      return;
    }
    onDone?.(res);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <form onSubmit={submit} noValidate style={{ padding: 'calc(var(--safe-top) + 12px) 20px 130px', maxWidth: 480, margin: '0 auto' }}>
        <SignupHeader />
        {banner && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        <SignupFields v={v} set={set} errors={errors} onLoginWithEmail={() => setLogin(true)} />
        <Button type="submit" variant="primary" disabled={busy} style={{ marginTop: 16 }}>
          新規アカウント登録
        </Button>
        <Button variant="secondary" onClick={onClose} style={{ marginTop: 12, minHeight: 56, borderRadius: 28 }}>
          登録せずにお試し（ゲスト）
        </Button>
        <TextLink onClick={() => setLogin(true)} style={{ marginTop: 8 }}>
          {'アカウントをお持ちの方は　ログイン'}
        </TextLink>
      </form>
    </div>
  );
}

// 登録が終わったとき（確定版 Final-14 の 9）。1回目はIDの確認（2回目）と［写真を設定する］（2回目）を出さない
export function GuestWelcome({ onClose, pendingEmail = false }) {
  return (
    <div role="dialog" aria-label="mogu へようこそ！" style={{ position: 'fixed', inset: 0, zIndex: 70, background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <div style={{ padding: 'calc(var(--safe-top) + 146px) 24px 0' }}>
        <h1 aria-label="mogu へようこそ！" className="no-zoom" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: font.dela, fontSize: 28, fontWeight: 400 }}>
          <img src={LOGO.black} alt="" style={{ display: 'block', width: 98, height: 34, objectFit: 'contain' }} />
          <span>へようこそ！</span>
        </h1>
        {pendingEmail && (
          <p role="status" style={{ margin: '28px 0 0', padding: '14px 16px', borderRadius: 18, background: color.surface, fontSize: 14, fontWeight: 700, lineHeight: 1.6 }}>
            確認のメールを送りました。メールのリンクを開くと、登録が終わります
          </p>
        )}
      </div>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 34 }}>
        <Button variant="secondary" onClick={onClose}>
          あとで
        </Button>
      </div>
    </div>
  );
}
