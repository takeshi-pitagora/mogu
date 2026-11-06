import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { chara, GUIDE } from '../../lib/chara';
import { handleFormatOk } from '../../lib/validate';
import Button from '../../components/ui/Button';
import HandleField from './HandleField';
import { ErrorBanner, TextLink } from './LoginParts';

// 確定版 Final-07 の14：今までの利用者に、次に開いたとき1度だけ出す「IDを決めよう」
//   仮のID（user_********）のまま使うこともできる（［あとで］）。本人が決めると handle_confirmed が立つ
export default function HandlePromptScreen({ onDone }) {
  const { user, updateProfile, markHandlePrompted } = useAuth();
  const [value, setValue] = useState(user?.handle || '');
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState(false);
  const harry = chara(GUIDE.harry);

  const skip = async () => {
    await markHandlePrompted();
    onDone?.();
  };

  const submit = async () => {
    const h = value.trim().toLowerCase();
    if (!handleFormatOk(h)) return;
    setBusy(true);
    setBanner('');
    const { error } = await updateProfile({ handle: h });
    await markHandlePrompted();
    setBusy(false);
    if (error) {
      setBanner(error);
      return;
    }
    onDone?.();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <div style={{ padding: 'calc(var(--safe-top) + 40px) 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src={harry?.framed} alt="" style={{ display: 'block', width: 92, height: 141, objectFit: 'contain', objectPosition: 'center bottom' }} />
        </div>
        <h1 className="no-zoom" style={{ margin: 0, fontFamily: font.dela, fontSize: 28, fontWeight: 400 }}>IDを決めよう</h1>
        <p style={{ margin: '10px 0 20px', fontSize: 14, lineHeight: 1.7 }}>友だちがあなたをグループに招待するときに使います。あとから設定でも変えられます。</p>
        {banner && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        )}
        <HandleField value={value} onChange={setValue} initialHandle={user?.handle || ''} />
        <Button variant="primary" onClick={submit} disabled={busy || !handleFormatOk(value.trim().toLowerCase())} style={{ marginTop: 24 }}>
          このIDにする
        </Button>
        <TextLink onClick={skip} style={{ marginTop: 8 }}>
          あとで
        </TextLink>
      </div>
    </div>
  );
}
