import { useEffect, useRef, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { NICKNAME_MAX, BIO_MAX, BIO_MAX_LINES, handleFormatOk } from '../../lib/validate';
import { checkHandle, checkText, photoUrlOf } from '../../lib/profile';
import { uploadAvatar, removeAvatar } from '../../lib/photo';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmSheet from '../../components/ui/ConfirmSheet';
import { useToast } from '../../components/ui/Toast';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';
import PhotoEditSheet from './PhotoEditSheet';

// プロフィールを編集（確定版 Final-04）の2回目の範囲
//   左上［キャンセル］・まん中「プロフィールを編集」・右上［保存］（変えたときだけ押せる）
//   写真（丸96・鉛筆の印）／名前（9文字）／ユーザーID（6つの状態）／自己紹介（70文字・改行4回）
//   「食スタイル診断」：キャラの小さな画像・タイプ・名前・日付と［更新］／未診断は［診断を受ける］
//   変更があるまま閉じようとしたら「変更を保存せずに閉じますか？」
const rowGrid = { display: 'grid', gridTemplateColumns: '84px minmax(0px, 1fr)', gap: 8, alignItems: 'center', minHeight: 56, margin: '0 -20px', padding: '0 20px' };
const rowGridTop = { ...rowGrid, alignItems: 'start', padding: '14px 20px' };

function countLines(s) {
  return (String(s || '').match(/\n/g) || []).length;
}

export default function ProfileEditSheet({ onClose, onDiagnose }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [handle, setHandleInput] = useState(user?.handle || '');
  const [asyncHandleState, setAsyncHandleState] = useState(null); // サーバーに確認した結果（checking/ok/taken/...）
  const [bioBanned, setBioBanned] = useState(false);
  const [nameFocus, setNameFocus] = useState(false);
  const [handleFocus, setHandleFocus] = useState(false);
  const [bioFocus, setBioFocus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [avatarPath, setAvatarPath] = useState(user?.avatarPath || null);
  const [pendingPhoto, setPendingPhoto] = useState(null); // 保存前の新しい写真（Blob）。null のままなら変えない
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const type = getType(user?.foodStyle);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;

  const handleTimer = useRef(null);
  const handleNorm = handle.trim().toLowerCase();
  const handleNeedsCheck = handleNorm !== '' && handleNorm !== (user?.handle || '') && handleFormatOk(handleNorm);
  useEffect(() => {
    if (!handleNeedsCheck) return undefined;
    clearTimeout(handleTimer.current);
    handleTimer.current = setTimeout(async () => {
      const r = await checkHandle(handleNorm);
      setAsyncHandleState({ ...r, forHandle: handleNorm });
    }, 450);
    return () => clearTimeout(handleTimer.current);
  }, [handleNeedsCheck, handleNorm]);

  // 表示する状態：サーバーの確認が必要ない場合は、入力だけで決まる（setState を伴わない）
  const handleState = (() => {
    if (handleNorm === (user?.handle || '')) return { status: 'same' };
    if (!handleNorm) return { status: 'empty' };
    if (!handleFormatOk(handleNorm)) return { status: 'format' };
    if (asyncHandleState?.forHandle === handleNorm) return asyncHandleState;
    return { status: 'checking' };
  })();

  const bioTimer = useRef(null);
  useEffect(() => {
    const t = bio.trim();
    clearTimeout(bioTimer.current);
    bioTimer.current = setTimeout(async () => setBioBanned(t ? await checkText(t) : false), 400);
    return () => clearTimeout(bioTimer.current);
  }, [bio]);

  const handleMessage = {
    same: '', ok: '', empty: '', checking: '',
    taken: 'このIDは使われています',
    format: 'IDは英小文字・数字・_の4〜20文字で、最初は英小文字か数字にしてください',
    reserved: 'このIDは使えません',
    banned: '使えない言葉が含まれています',
    cooldown: 'IDを変えてからまだ2週間たっていません。次に変えられるのは2週間後です',
    rate: '少し待ってから、もう一度お試しください',
    error: '確認できませんでした',
  }[handleState.status] || '';
  const handleOk = handleState.status === 'ok' || handleState.status === 'same';
  const handleBad = ['taken', 'format', 'reserved', 'banned', 'cooldown', 'rate', 'error'].includes(handleState.status);

  const nameChanged = name.trim() !== (user?.name || '') && name.trim().length > 0;
  const handleChanged = handle.trim().toLowerCase() !== (user?.handle || '') && handleOk;
  const bioChanged = bio !== (user?.bio || '') && !bioBanned && bio.length <= BIO_MAX && countLines(bio) <= BIO_MAX_LINES;
  const photoChanged = !!pendingPhoto || photoRemoved;
  const changed = nameChanged || handleChanged || bioChanged || photoChanged;

  const date = (() => {
    const d = user?.moguType?.linkedAt ? new Date(user.moguType.linkedAt) : null;
    return d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}月${d.getDate()}日に連携` : '';
  })();

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    setError('');

    let newAvatarPath = avatarPath;
    if (pendingPhoto) {
      const r = await uploadAvatar(user.id, pendingPhoto, user.avatarPath);
      if (r.error) {
        setSaving(false);
        setError(r.error);
        return;
      }
      newAvatarPath = r.path;
    } else if (photoRemoved) {
      if (user.avatarPath) await removeAvatar(user.avatarPath);
      newAvatarPath = null;
    }

    const updates = {};
    if (nameChanged) updates.name = name.trim();
    if (handleChanged) updates.handle = handle.trim().toLowerCase();
    if (bioChanged) updates.bio = bio;
    if (photoChanged) updates.avatarPath = newAvatarPath;

    const { error: e } = await updateProfile(updates);
    setSaving(false);
    if (e) {
      setError(e);
      return;
    }
    setAvatarPath(newAvatarPath);
    setPendingPhoto(null);
    setPhotoRemoved(false);
    toast?.show('保存しました');
    onClose();
  };
  const requestClose = () => (changed ? setConfirm(true) : onClose());

  const previewUrl = pendingPhoto ? URL.createObjectURL(pendingPhoto) : photoRemoved ? null : photoUrlOf(avatarPath);

  return (
    <>
      <BottomSheet
        open
        onClose={onClose}
        onRequestClose={requestClose}
        height="calc(100% - var(--safe-top) - 8px)"
        maxHeight="none"
        padding="10px 0 0"
        headerMargin="0"
        header={{ left: { label: 'キャンセル', onClick: requestClose }, title: 'プロフィールを編集', right: { label: '保存', onClick: save, disabled: !changed || saving } }}
      >
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', marginTop: 8 }}>
          <div style={{ padding: '6px 20px 60px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                aria-label="写真を変える"
                onClick={() => setPhotoSheet(true)}
                style={{ position: 'relative', flex: 'none', width: 96, height: 96, padding: 0, border: 0, background: 'transparent' }}
              >
                <Avatar size={96} photoUrl={previewUrl} name={name} label="写真" />
                <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: '50%', background: color.ink, color: color.white, boxShadow: `0 0 0 3px ${color.white}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pencil" size={16} strokeWidth={2.75} />
                </span>
              </button>
            </div>

            <h3 style={{ margin: '22px 0 8px', fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>プロフィール</h3>
            <div style={{ borderTop: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
              <label style={{ ...rowGrid, background: nameFocus ? color.surface : 'transparent' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: color.ink }}>名前</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, NICKNAME_MAX))}
                    onFocus={() => setNameFocus(true)}
                    onBlur={() => setNameFocus(false)}
                    maxLength={NICKNAME_MAX}
                    aria-label="名前"
                    autoComplete="nickname"
                    style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 16, color: color.ink }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: name.length >= NICKNAME_MAX ? color.red : color.sub }}>
                    {name.length}/{NICKNAME_MAX}
                  </span>
                </span>
              </label>

              <div style={{ ...rowGrid, borderTop: `1px solid ${color.line}`, background: handleFocus ? color.surface : 'transparent' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: color.ink }}>ユーザーID</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, height: 40,
                      fontSize: 16, color: color.ink,
                    }}
                  >
                    <span style={{ flex: '0 0 auto', color: color.sub }}>@</span>
                    <input
                      value={handle}
                      onChange={(e) => setHandleInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                      onFocus={() => setHandleFocus(true)}
                      onBlur={() => setHandleFocus(false)}
                      maxLength={20}
                      aria-label="ユーザーID"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 16, color: color.ink }}
                    />
                    {handleState.status === 'checking' ? (
                      <Icon name="refresh" size={18} color={color.sub} />
                    ) : handleOk && handle.trim() ? (
                      <Icon name="check" size={20} color={color.ink} />
                    ) : handleBad ? (
                      <Icon name="warning" size={20} color={color.red} />
                    ) : null}
                  </div>
                  {handleMessage && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: handleBad ? color.red : color.ink }}>{handleMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...rowGridTop, borderTop: `1px solid ${color.line}`, background: bioFocus ? color.surface : 'transparent' }}>
                <span style={{ paddingTop: 2, fontSize: 14, fontWeight: 700, color: color.ink }}>自己紹介</span>
                <div>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      const v = e.target.value;
                      const lines = countLines(v);
                      if (lines > BIO_MAX_LINES) return;
                      setBio(v.slice(0, BIO_MAX));
                    }}
                    onFocus={() => setBioFocus(true)}
                    onBlur={() => setBioFocus(false)}
                    rows={3}
                    aria-label="自己紹介"
                    placeholder="好きなお店のジャンルや、よく行くエリアなど"
                    style={{ width: '100%', border: 0, outline: 'none', resize: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65, color: color.ink }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, fontWeight: 700, color: bio.length >= BIO_MAX || bioBanned ? color.red : color.sub }}>
                    <span>{bioBanned ? '使えない言葉が含まれています' : bio.length >= BIO_MAX ? `上限の${BIO_MAX}文字です` : ''}</span>
                    <span>{bio.length}/{BIO_MAX}</span>
                  </div>
                </div>
              </div>
            </div>
            {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}

            <h3 style={{ margin: '28px 0 8px', fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>食スタイル診断</h3>
            <div style={{ borderTop: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
              {type ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 80 }}>
                  {ch && <img src={ch.framed} alt="" style={{ flex: 'none', width: 46, height: 70, objectFit: 'contain', objectPosition: 'center bottom' }} />}
                  <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontFamily: font.dela, fontSize: 12, color: g ? g.dark : color.ink }}>{type.code}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{type.name}</span>
                    {date && <span style={{ fontSize: 12, color: color.sub }}>{date}</span>}
                  </div>
                  <button type="button" className="ui-btn ui-btn--small" onClick={onDiagnose} style={{ flex: 'none', height: 44, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                    更新
                  </button>
                </div>
              ) : (
                <div style={{ padding: '14px 0' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>まだ診断していません</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: color.sub }}>Mogu Type の診断を受けると、キャラが立ちます</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={onDiagnose} style={{ flex: 1, height: 44, border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                      診断を受ける
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </BottomSheet>

      <PhotoEditSheet
        open={photoSheet}
        hasPhoto={!!previewUrl}
        onClose={() => setPhotoSheet(false)}
        onChange={(blobOrNull) => {
          setPhotoSheet(false);
          if (blobOrNull === null) {
            setPendingPhoto(null);
            setPhotoRemoved(true);
          } else {
            setPendingPhoto(blobOrNull);
            setPhotoRemoved(false);
          }
        }}
      />

      <ConfirmSheet
        open={confirm}
        title="変更を保存せずに閉じますか？"
        actionLabel="保存せずに閉じる"
        danger
        cancelLabel="編集を続ける"
        onConfirm={() => {
          setConfirm(false);
          onClose();
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
