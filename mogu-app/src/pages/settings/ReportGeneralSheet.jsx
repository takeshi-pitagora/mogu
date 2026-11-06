import { useState } from 'react';
import { color, font } from '../../theme/tokens';
import { submitReport } from '../../lib/profile';
import { pickImageFile, uploadReportScreenshot } from '../../lib/photo';
import { useAuth } from '../../context/AuthContext';
import BottomSheet from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import TextField from '../../components/ui/TextField';

const REASONS = [
  { id: 'photo', label: '不適切な写真' },
  { id: 'profile', label: '名前・自己紹介' },
  { id: 'impersonation', label: 'なりすまし' },
  { id: 'harassment', label: 'いやがらせ' },
  { id: 'group', label: 'グループ' },
  { id: 'other', label: 'その他' },
];
const DETAIL_MAX = 1000;

// 設定の中「通報したい内容がある」（確定版 f13-13・f13-14）
//   下から出るシート。相手のユーザーID（わかれば）・内容の種類・くわしい内容・スクリーンショット（付けなくてもよい）
export default function ReportGeneralSheet({ open, onClose }) {
  const { user } = useAuth();
  const [targetHandle, setTargetHandle] = useState('');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [shots, setShots] = useState([]); // [{ file, url }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => {
    setTargetHandle('');
    setReason('');
    setDetail('');
    setShots([]);
    setError('');
    setDone(false);
  };
  const close = () => {
    reset();
    onClose?.();
  };

  const addShot = async () => {
    if (shots.length >= 3) return;
    const file = await pickImageFile();
    if (!file) return;
    setShots((s) => [...s, { file, url: URL.createObjectURL(file) }]);
  };
  const removeShot = (i) => setShots((s) => s.filter((_, idx) => idx !== i));

  const canSend = !busy && !!reason;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError('');
    const paths = [];
    for (const s of shots) {
      const r = await uploadReportScreenshot(user.id, s.file);
      if (r.error) {
        setBusy(false);
        setError(r.error);
        return;
      }
      paths.push(r.path);
    }
    const res = await submitReport({
      kind: 'general',
      reason,
      detail: detail.trim() || null,
      targetHandle: targetHandle.trim() || null,
      screenshots: paths,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="送信しました" minHeight={250}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
          <span style={{ display: 'flex', width: 64, height: 64, borderRadius: '50%', background: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={color.white} />
          </span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>送信しました</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>内容を確認して対応します</p>
        <Button variant="secondary" onClick={close} style={{ marginTop: 22 }}>
          閉じる
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      header={{ left: { label: 'キャンセル', onClick: close }, title: '通報したい内容がある', right: { label: '送信', onClick: send, disabled: !canSend } }}
      maxHeight="92%"
    >
      <div style={{ marginTop: 14, overflowY: 'auto' }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.sub }}>アプリの中で困ったことを教えてください。</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>相手のユーザーID</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: color.sub }}>わかれば</span>
        </div>
        <TextField prefix="@" value={targetHandle} onChange={(v) => setTargetHandle(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))} autoComplete="off" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>内容の種類</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => {
            const selected = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className="ui-btn ui-press"
                style={{ height: 44, padding: '0 16px', border: `2px solid ${color.ink}`, borderRadius: 22, background: selected ? color.ink : color.white, color: selected ? color.white : color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>くわしい内容</span>
        </div>
        <TextField multiline rows={4} maxLength={DETAIL_MAX} showCount value={detail} onChange={setDetail} placeholder="くわしい内容を入れてください" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 8px' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>スクリーンショット</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: color.sub }}>付けなくてもよい</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {shots.map((s, i) => (
            <span key={s.url} style={{ position: 'relative', display: 'block', width: 88, height: 88, border: `2px solid ${color.ink}`, borderRadius: 16, overflow: 'hidden', background: color.surface }}>
              <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                type="button"
                aria-label="このスクリーンショットを外す"
                onClick={() => removeShot(i)}
                style={{ position: 'absolute', right: 4, top: 4, width: 24, height: 24, border: 0, borderRadius: '50%', background: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={14} color={color.white} />
              </button>
            </span>
          ))}
          {shots.length < 3 && (
            <button
              type="button"
              onClick={addShot}
              style={{ width: 88, height: 88, border: `2px dashed ${color.ink}`, borderRadius: 16, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Icon name="imageAdd" size={24} />
              追加
            </button>
          )}
        </div>

        {error && <p role="alert" style={{ margin: '16px 0 0', fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: color.red }}>{error}</p>}
      </div>
    </BottomSheet>
  );
}
