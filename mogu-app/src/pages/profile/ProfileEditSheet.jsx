import { useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { NICKNAME_MAX } from '../../lib/validate';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmSheet from '../../components/ui/ConfirmSheet';
import { useToast } from '../../components/ui/Toast';

// プロフィールを編集（確定版 Final-04 シート型）の1回目の範囲
//   左上［キャンセル］・まん中「プロフィールを編集」・右上［保存］（変えたときだけ押せる）
//   「プロフィール」：名前（9文字まで・残りの文字数）。写真・ユーザーID・自己紹介は2回目
//   「食スタイル診断」：キャラの小さな画像・タイプ・名前・日付と［更新］／未診断は［診断を受ける］
//   変更があるまま閉じようとしたら「変更を保存せずに閉じますか？」
const rowGrid = { display: 'grid', gridTemplateColumns: '84px minmax(0px, 1fr)', gap: 8, alignItems: 'center', minHeight: 56, margin: '0 -20px', padding: '0 20px' };

export default function ProfileEditSheet({ onClose, onDiagnose }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [focus, setFocus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const type = getType(user?.foodStyle);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;
  const changed = name.trim() !== (user?.name || '') && name.trim().length > 0;
  const date = (() => {
    const d = user?.foodAxes?.at ? new Date(user.foodAxes.at) : null;
    return d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}月${d.getDate()}日に連携` : '';
  })();

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    setError('');
    const { error: e } = await updateProfile({ name: name.trim(), avatar: user.avatar, foodStyle: user.foodStyle });
    setSaving(false);
    if (e) {
      setError(e);
      return;
    }
    toast?.show('保存しました');
    onClose();
  };
  const requestClose = () => (changed ? setConfirm(true) : onClose());

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
            <h3 style={{ margin: '14px 0 8px', fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>プロフィール</h3>
            <div style={{ borderTop: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
              <label style={{ ...rowGrid, background: focus ? color.surface : 'transparent' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: color.ink }}>名前</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, NICKNAME_MAX))}
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
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
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: color.sub }}>20問・約5分。終わるとキャラが立ちます</p>
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
