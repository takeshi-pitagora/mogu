import { useEffect, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { chara } from '../../lib/chara';
import { getType } from '../../lib/mogutype';
import { DIAGNOSE_URL, fetchMoguTypeResult, friendCodeFormatOk, MYPAGE_URL, normalizeFriendCode } from '../../lib/mogutypeApi';
import { openExternal } from '../../lib/open';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Icon from '../../components/ui/Icon';
import TypeLabel from '../../components/ui/TypeLabel';
import BottomSheet from '../../components/ui/BottomSheet';

// 食スタイル診断（Mogu Type 連携 v2）。マイページの［診断］／アカウントの「食スタイル診断」は、どちらもここに入る（§4-1）
//   いま確定している画面（Final-03・f03-7）には無い新しい画面なので、文言は仕様書（§2〜§4）どおりの最小限にしています。
//   デザインが決まったら、確定版の見本に合わせて作り直してください
export default function DiagnosisScreen({ onClose, initialIntent, pendingFriendCode, onConsumedPendingCode }) {
  const { user, linkMoguType, unlinkMoguType } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // 保存前の確認：{ friendCode, result }
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const linked = !!user?.moguType?.code;

  useEffect(() => {
    if (initialIntent === 'diagnose') openExternal(DIAGNOSE_URL);
    else if (initialIntent === 'import') openExternal(MYPAGE_URL);
    // 画面を開いた最初の1回だけ（初期値が変わっても再度は開かない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingFriendCode) return;
    const code2 = pendingFriendCode;
    onConsumedPendingCode?.();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError('');
      const r = await fetchMoguTypeResult(code2);
      setBusy(false);
      if (r.error) {
        setError(r.error);
        return;
      }
      setPending({ friendCode: normalizeFriendCode(code2), result: r.data });
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingFriendCode, onConsumedPendingCode]);

  const lookup = async () => {
    if (!friendCodeFormatOk(code)) {
      setError('コードは英数字8文字だよ。もう一度確認してね');
      return;
    }
    setBusy(true);
    setError('');
    const r = await fetchMoguTypeResult(code);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setPending({ friendCode: normalizeFriendCode(code), result: r.data });
  };

  const refresh = async () => {
    if (!user?.moguType?.friendCode) return;
    setBusy(true);
    setError('');
    const r = await fetchMoguTypeResult(user.moguType.friendCode);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setPending({ friendCode: user.moguType.friendCode, result: r.data });
  };

  const confirmSave = async () => {
    setBusy(true);
    setError('');
    const res = await linkMoguType(pending.friendCode, pending.result);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose?.();
  };

  const doUnlink = async () => {
    setBusy(true);
    const res = await unlinkMoguType();
    setBusy(false);
    setUnlinkConfirm(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose?.();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <header style={{ paddingTop: 'var(--safe-top)' }}>
        <div style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} />
          </button>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: font.dela, fontSize: 16, whiteSpace: 'nowrap' }}>食スタイル診断</span>
          <span style={{ width: 44 }} />
        </div>
      </header>

      <div style={{ padding: '12px 20px 60px', maxWidth: 480, margin: '0 auto' }}>
        {pending ? (
          <ConfirmCard pending={pending} busy={busy} error={error} onCancel={() => setPending(null)} onConfirm={confirmSave} />
        ) : linked ? (
          <LinkedView user={user} busy={busy} error={error} onRefresh={refresh} onUnlink={() => setUnlinkConfirm(true)} />
        ) : (
          <UnlinkedView code={code} setCode={setCode} busy={busy} error={error} onLookup={lookup} />
        )}
      </div>

      <BottomSheet open={unlinkConfirm} onClose={() => setUnlinkConfirm(false)} ariaLabel="連携を解除しますか？" minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, textAlign: 'center' }}>連携を解除しますか？</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, textAlign: 'center', color: color.sub }}>サイト側の結果は消えません。アプリのプロフィールの表示だけが元に戻ります</p>
        <Button variant="danger" onClick={doUnlink} disabled={busy} style={{ marginTop: 18 }}>
          連携を解除する
        </Button>
        <Button variant="secondary" onClick={() => setUnlinkConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}

function UnlinkedView({ code, setCode, busy, error, onLookup }) {
  return (
    <>
      <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.7 }}>
        食スタイル診断は、Webの「Mogu Type」で行います。診断が終わったら、サイトの［Moguアプリに結果を送る］を押してください。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        <Button variant="primary" onClick={() => openExternal(DIAGNOSE_URL)}>
          診断を受ける
        </Button>
        <Button variant="secondary" onClick={() => openExternal(MYPAGE_URL)}>
          診断結果を取り込む
        </Button>
      </div>
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${color.line}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: color.sub }}>アプリに戻れないときは、フレンドコードで連携できます</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: color.sub }}>サイトのマイページの「あなたのコード」にあります</p>
        <TextField
          label="フレンドコード"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder="ABCD2345"
          error={error}
          style={{ marginTop: 10 }}
        />
        <Button variant="secondary" onClick={onLookup} disabled={busy || !code.trim()} style={{ marginTop: 10 }}>
          連携する
        </Button>
      </div>
    </>
  );
}

function LinkedView({ user, busy, error, onRefresh, onUnlink }) {
  const type = getType(user.moguType.code);
  const ch = type ? chara(type.code) : null;
  const date = user.moguType.linkedAt ? new Date(user.moguType.linkedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日に連携` : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      {ch && <img src={ch.framed} alt="" style={{ display: 'block', width: 160, height: 244, objectFit: 'contain', objectPosition: 'center bottom' }} />}
      {type && <TypeLabel code={type.code} />}
      {user.moguType.nickname && <p style={{ margin: '12px 0 0', fontSize: 13, color: color.sub }}>{user.moguType.nickname}さんの結果</p>}
      {dateText && <p style={{ margin: '4px 0 0', fontSize: 12, color: color.sub }}>{dateText}</p>}
      {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, width: '100%' }}>
        <Button variant="secondary" onClick={onRefresh} disabled={busy}>
          結果を更新
        </Button>
        <Button variant="text" onClick={onUnlink} disabled={busy} style={{ color: color.sub }}>
          連携を解除
        </Button>
      </div>
    </div>
  );
}

function ConfirmCard({ pending, busy, error, onCancel, onConfirm }) {
  const { result } = pending;
  const type = getType(result.typeCode);
  const g = type ? groupColor[groupOf(type.code)] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ margin: '8px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>この結果をMoguで使いますか？</h2>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: color.sub }}>他の人のフレンドコードでないか、確認してください</p>
      <div
        style={{
          marginTop: 18,
          width: '100%',
          maxWidth: 280,
          padding: '18px 16px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderRadius: 24,
          background: g ? g.light : color.surface,
        }}
      >
        {result.imageUrl && <img src={result.imageUrl} alt="" style={{ display: 'block', width: 140, height: 210, margin: '0 auto', objectFit: 'contain', objectPosition: 'center bottom' }} />}
        <p style={{ margin: '8px 0 0', fontFamily: font.dela, fontSize: 13, color: g ? g.dark : color.ink }}>{result.typeCode}</p>
        <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700 }}>{result.characterName}</p>
        {result.nickname && <p style={{ margin: '4px 0 0', fontSize: 13, color: color.sub }}>{result.nickname}さんの結果</p>}
      </div>
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22, width: '100%' }}>
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          この結果を使う
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          やめる
        </Button>
      </div>
    </div>
  );
}
