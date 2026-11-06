import { useEffect, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { blockUser, getProfileView, photoUrlOf, submitReport, unblockUser } from '../../lib/profile';
import { useToast } from '../../components/ui/Toast';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { Radio } from '../../components/ui/Radio';
import BottomSheet from '../../components/ui/BottomSheet';
import TypeLabel from '../../components/ui/TypeLabel';

// 他の人のプロフィール（確定版 f03-5・f03-6）＋「…」の通報・ブロック（f13-1〜f13-20の、相手を指定するほう）
//   同じグループのメンバーの行から開く（userId）。IDの完全一致（handle）でも開ける
const REASONS = [
  { id: 'photo', label: '不適切な写真' },
  { id: 'profile', label: '不適切な名前・自己紹介' },
  { id: 'impersonation', label: 'なりすまし' },
  { id: 'harassment', label: 'いやがらせ・しつこい招待' },
  { id: 'other', label: 'その他' },
];
const OTHER_DETAIL_MAX = 200;

// 「…」：通報する／ブロックする／キャンセル（f13-2・f13-15）
function MoreSheet({ open, onClose, name, onReport, onBlock }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${name} さん`}>
      <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>{name} さん</p>
      <button
        type="button"
        onClick={onReport}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderWidth: '1px 0 0', padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
      >
        <Icon name="flag" size={22} color={color.red} />
        通報する
      </button>
      <button
        type="button"
        onClick={onBlock}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}`, padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
      >
        <Icon name="block" size={22} color={color.red} />
        ブロックする
      </button>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 16 }}>
        キャンセル
      </Button>
    </BottomSheet>
  );
}

// 通報する：理由を選ぶ→その他は内容を書く→送信→受け付けました（f13-3・f13-4・f13-5・f13-16・f13-17）
function ReportSheet({ open, onClose, targetId, name, onBlockAfter }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const close = () => {
    setReason(null);
    setOtherText('');
    setError('');
    setSent(false);
    onClose?.();
  };

  const send = async () => {
    if (!reason || (reason === 'other' && !otherText.trim())) return;
    setBusy(true);
    setError('');
    const res = await submitReport({ kind: 'user', reason, detail: reason === 'other' ? otherText.trim() : null, targetUser: targetId });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="通報を受け付けました" minHeight={250}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
          <span style={{ display: 'flex', width: 64, height: 64, borderRadius: '50%', background: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={color.white} />
          </span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>通報を受け付けました</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>内容を確認して対応します</p>
        <Button
          variant="danger"
          onClick={() => {
            close();
            onBlockAfter?.();
          }}
          style={{ marginTop: 22 }}
        >
          この人をブロックする
        </Button>
        <Button variant="secondary" onClick={close} style={{ marginTop: 10 }}>
          閉じる
        </Button>
      </BottomSheet>
    );
  }

  if (reason === 'other') {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="通報する">
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: font.dela, fontSize: 18 }}>通報する</div>
          <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{name} さん</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, marginTop: 12, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}` }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>その他</span>
          <button type="button" onClick={() => setReason(null)} style={{ height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}>
            理由を変える
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ minHeight: 96, padding: '12px 17px', border: `${stroke.focus}px solid ${color.ink}`, borderRadius: 18, background: color.white }}>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value.slice(0, OTHER_DETAIL_MAX))}
              placeholder="くわしい内容を入れてください"
              rows={3}
              style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65, color: color.ink }}
            />
          </div>
          <div style={{ marginTop: 6, textAlign: 'right', fontSize: 12, fontWeight: 700, color: color.sub }}>
            {otherText.length}/{OTHER_DETAIL_MAX}
          </div>
        </div>
        {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
        <Button variant="primary" onClick={send} disabled={busy || !otherText.trim()} style={{ marginTop: 8 }}>
          送信する
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} ariaLabel="通報する">
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: font.dela, fontSize: 18 }}>通報する</div>
        <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{name} さん</div>
      </div>
      <p style={{ margin: '14px 0 10px', fontSize: 13, fontWeight: 700, color: color.sub }}>あてはまるものを1つ選んでください</p>
      <div role="radiogroup" aria-label="通報の理由" style={{ borderBottom: `1px solid ${color.line}` }}>
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ flex: '1 1 0%', textAlign: 'left', fontSize: 16, fontWeight: reason === r.id ? 700 : 500 }}>{r.label}</span>
            <Radio on={reason === r.id} />
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      <Button variant="primary" disabled={busy || !reason} onClick={send} style={{ marginTop: 20 }}>
        送信する
      </Button>
    </BottomSheet>
  );
}

export default function OtherProfileScreen({ userId, handle, onBack }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    getProfileView({ userId, handle }).then((r) => {
      if (!alive) return;
      setData(r.data || null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, handle]);

  const doBlock = async () => {
    setBlockConfirm(false);
    const res = await blockUser(data.id);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    setData((d) => ({ ...d, blocked: true, blocked_by_me: true }));
    toast?.show('ブロックしました', {
      undo: async () => {
        const r = await unblockUser(data.id);
        if (!r.error) setData((d) => ({ ...d, blocked: false, blocked_by_me: false }));
      },
    });
  };

  const doUnblock = async () => {
    const res = await unblockUser(data.id);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    setData((d) => ({ ...d, blocked: false, blocked_by_me: false }));
  };

  const header = (
    <header style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 98, padding: '54px 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: color.bg, zIndex: 4 }}>
      <button type="button" aria-label="戻る" onClick={onBack} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={24} />
      </button>
      <button type="button" aria-label="その他（通報・ブロック）" onClick={() => setMore(true)} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="moreFill" size={24} />
      </button>
    </header>
  );

  if (loading || !data) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: color.bg, fontFamily: font.plex, color: color.ink }}>
        {header}
      </div>
    );
  }

  const name = data.display_name || data.handle || '';
  const type = getType(data.type_code);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;
  const bubbleBg = type ? (g ? g.light : color.surface) : color.surface;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      {header}
      <div style={{ padding: 'calc(var(--safe-top) + 44px + 12px) 20px 130px' }}>
        {data.blocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
            <Avatar size={72} blocked name={data.handle} />
            <span style={{ display: 'block', marginTop: 10, fontSize: 13, color: color.sub }}>@{data.handle}</span>
            <p style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 700 }}>ブロック中のユーザーです</p>
            <button type="button" onClick={doUnblock} style={{ marginTop: 10, height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}>
              ブロックを解除
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
            <div style={{ flex: 'none', width: 129, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {ch ? (
                <img src={ch.framed} alt="" style={{ display: 'block', width: 129, height: 197, objectFit: 'contain', objectPosition: 'center bottom' }} />
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 129, height: 197, fontFamily: font.dela, fontSize: 120, lineHeight: 1, color: color.ink }}>？</span>
              )}
              {type && <TypeLabel code={type.code} />}
            </div>
            <div style={{ flex: '0 0 auto', width: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar size={40} photoUrl={photoUrlOf(data.avatar_path)} name={name} label="写真" />
                <span style={{ minWidth: 0, fontSize: 13, color: color.sub, overflowWrap: 'anywhere' }}>@{data.handle || ''}</span>
              </div>
              <h1 className="no-zoom" style={{ margin: '8px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</h1>
              <div style={{ position: 'relative', marginTop: 12, width: 220, padding: '10px 10px 12px', border: `${stroke.shape}px solid ${type ? color.ink : color.surface}`, borderRadius: 22, background: bubbleBg }}>
                {type && (
                  <span aria-hidden="true" style={{ position: 'absolute', left: -11, top: 22, width: 18, height: 18, borderLeft: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}`, background: bubbleBg, transform: 'rotate(45deg)' }} />
                )}
                <span style={{ position: 'relative', display: 'block', fontSize: 12, fontWeight: 700, color: type ? color.ink : color.sub }}>
                  {type ? `${type.name}が紹介します` : '自己紹介'}
                </span>
                {data.bio ? <p style={{ position: 'relative', width: '14em', margin: '4px 0 0', fontSize: 14, lineHeight: 1.65, overflowWrap: 'anywhere' }}>{data.bio}</p> : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <MoreSheet
        open={more}
        onClose={() => setMore(false)}
        name={name}
        onReport={() => {
          setMore(false);
          setReport(true);
        }}
        onBlock={() => {
          setMore(false);
          setBlockConfirm(true);
        }}
      />
      <ReportSheet open={report} onClose={() => setReport(false)} targetId={data.id} name={name} onBlockAfter={() => setBlockConfirm(true)} />
      <BottomSheet open={blockConfirm} onClose={() => setBlockConfirm(false)} ariaLabel={`${name} さんをブロックしますか？`} minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4, textAlign: 'center' }}>
          @{data.handle} さんを
          <br />
          ブロックしますか？
        </h2>
        <Button variant="danger" onClick={doBlock} style={{ marginTop: 18 }}>
          ブロックする
        </Button>
        <Button variant="secondary" onClick={() => setBlockConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}
