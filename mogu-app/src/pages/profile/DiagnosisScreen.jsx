import { useEffect, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { chara } from '../../lib/chara';
import { getType } from '../../lib/mogutype';
import { DIAGNOSE_URL, fetchMoguTypeResult, MYPAGE_URL } from '../../lib/mogutypeApi';
import { openExternal } from '../../lib/open';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import TypeLabel from '../../components/ui/TypeLabel';
import BottomSheet from '../../components/ui/BottomSheet';

// 食スタイル診断（Mogu Type 連携 v2）。マイページの［診断］／アカウントの「食スタイル診断」は、どちらもここに入る（§4-1）
//   確定版 Final-06（画面ごとの仕様 ⑥）のとおり：未連携 → サイトに移る前の案内 → Safari → 取り込みの確認 → 連携済み
//   フレンドコードの手入力は作らない（引き渡し書 §7-4：連携仕様v2からの変更点。入れないことが確定している）
export default function DiagnosisScreen({ onClose, initialIntent, pendingFriendCode, onConsumedPendingCode }) {
  const { user, linkMoguType, unlinkMoguType } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // 保存前の確認：{ friendCode, result }
  const [intro, setIntro] = useState(initialIntent === 'diagnose' || initialIntent === 'import' ? initialIntent : null); // サイトに移る前の案内
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const linked = !!user?.moguType?.code;

  useEffect(() => {
    if (!pendingFriendCode) return;
    const code2 = pendingFriendCode;
    onConsumedPendingCode?.();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      const r = await fetchMoguTypeResult(code2);
      setBusy(false);
      if (r.error) {
        setError({ message: r.error, code: r.errorCode });
        return;
      }
      setPending({ friendCode: code2, result: r.data });
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingFriendCode, onConsumedPendingCode]);

  const openSite = (url) => {
    setIntro(null);
    openExternal(url);
  };

  const refresh = async () => {
    if (!user?.moguType?.friendCode) return;
    setBusy(true);
    setError(null);
    const r = await fetchMoguTypeResult(user.moguType.friendCode);
    setBusy(false);
    if (r.error) {
      setError({ message: r.error, code: r.errorCode });
      return;
    }
    setPending({ friendCode: user.moguType.friendCode, result: r.data });
  };

  const confirmSave = async () => {
    setBusy(true);
    setError(null);
    const res = await linkMoguType(pending.friendCode, pending.result);
    setBusy(false);
    if (res.error) {
      setError({ message: res.error });
      setPending(null);
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
      setError({ message: res.error });
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
        {error ? (
          <ErrorView error={error} busy={busy} onRetryDiagnose={() => setIntro('diagnose')} onRetry={linked ? refresh : () => setError(null)} />
        ) : pending ? (
          <ConfirmCard pending={pending} busy={busy} onCancel={() => setPending(null)} onConfirm={confirmSave} />
        ) : linked ? (
          <LinkedView user={user} busy={busy} onRefresh={refresh} onUnlink={() => setUnlinkConfirm(true)} />
        ) : (
          <UnlinkedView onDiagnose={() => setIntro('diagnose')} onImport={() => setIntro('import')} />
        )}
      </div>

      <BottomSheet open={!!intro} onClose={() => setIntro(null)} ariaLabel="モグタイプを開きます" minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, textAlign: 'center' }}>モグタイプを開きます</h2>
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.7, textAlign: 'center' }}>
          Safari でモグタイプが開きます。結果画面の［Moguアプリに結果を送る］を押すと、ここに戻ってきます
        </p>
        <Button variant="primary" onClick={() => openSite(intro === 'import' ? MYPAGE_URL : DIAGNOSE_URL)} style={{ marginTop: 18 }}>
          開く
        </Button>
        <Button variant="secondary" onClick={() => setIntro(null)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>

      <BottomSheet open={unlinkConfirm} onClose={() => setUnlinkConfirm(false)} ariaLabel="連携を解除しますか？" minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, textAlign: 'center' }}>連携を解除しますか？</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, textAlign: 'center', color: color.sub }}>連携を解除すると、プロフィールのキャラが消えます。モグタイプの診断結果は消えません</p>
        <Button variant="danger" onClick={doUnlink} disabled={busy} style={{ marginTop: 18 }}>
          解除する
        </Button>
        <Button variant="secondary" onClick={() => setUnlinkConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}

// 未連携（確定版 Final-06 の「？？？？」の空のパス）。フレンドコードの入力欄は置かない（§7-4）
function UnlinkedView({ onDiagnose, onImport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ marginTop: 18, width: '100%', maxWidth: 280, padding: '26px 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: color.surface }}>
        <p style={{ margin: 0, fontFamily: font.dela, fontSize: 28, letterSpacing: '0.12em', color: color.sub }}>？？？？</p>
        <p style={{ margin: '10px 0 0', fontFamily: font.dela, fontSize: 16 }}>まだパスがありません</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: color.sub }}>パスを作ろう</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, width: '100%' }}>
        <Button variant="primary" onClick={onDiagnose}>
          診断を受ける
        </Button>
        <Button variant="secondary" onClick={onImport}>
          診断結果を取り込む
        </Button>
      </div>
    </div>
  );
}

// 連携済み（確定版 Final-06）。4軸カードとパスのNo.はAPIにまだ無いので出さない（§7-4・§10-2が決まるまで）
function LinkedView({ user, busy, onRefresh, onUnlink }) {
  const type = getType(user.moguType.code);
  const detailUrl = user.moguType.detailUrl || MYPAGE_URL;
  const date = user.moguType.linkedAt ? new Date(user.moguType.linkedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日に連携` : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <MoguTypeCard code={type?.code} characterName={user.moguType.characterName} nickname={user.moguType.nickname} />
      {dateText && <p style={{ margin: '10px 0 0', fontSize: 12, color: color.sub }}>{dateText}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, width: '100%' }}>
        <Button variant="secondary" onClick={onRefresh} disabled={busy}>
          結果を更新
        </Button>
        <Button variant="text" onClick={onUnlink} disabled={busy} style={{ color: color.sub }}>
          連携を解除
        </Button>
        <Button variant="text" onClick={() => openExternal(detailUrl)} style={{ color: color.sub }}>
          モグタイプでくわしく見る
        </Button>
      </div>
    </div>
  );
}

// 取り込みの確認（確定版 Final-06）
function ConfirmCard({ pending, busy, onCancel, onConfirm }) {
  const { result } = pending;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <h2 style={{ margin: '8px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>この結果が、あなたのパスになります</h2>
      <MoguTypeCard code={result.typeCode} characterName={result.characterName} nickname={result.nickname} imageUrl={result.imageUrl} style={{ marginTop: 18 }} />
      <p style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 700 }}>この結果をmoguで使いますか？</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, width: '100%' }}>
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          使う
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          やめる
        </Button>
      </div>
    </div>
  );
}

// エラー（§画面ごとの仕様 ⑥）。409＝まだ新しい診断を受けていない／500＝サーバーのエラー
function ErrorView({ error, busy, onRetryDiagnose, onRetry }) {
  const isNotFull = error.code === 'not_full_diagnosis';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 40 }}>
      <Icon name="warning" size={40} color={color.sub} />
      <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.7 }}>{error.message}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22, width: '100%' }}>
        <Button variant="primary" onClick={isNotFull ? onRetryDiagnose : onRetry} disabled={busy}>
          {isNotFull ? 'モグタイプで診断する' : 'もう一度試す'}
        </Button>
      </div>
    </div>
  );
}

// パス（タイプのコードを縦に積み、キャラの全身を右に大きく。4つの入口＝③④⑥⑩⑪⑬で共通に使う）
function MoguTypeCard({ code, characterName, nickname, imageUrl, style }) {
  const type = getType(code);
  const g = type ? groupColor[groupOf(type.code)] : null;
  const ch = !imageUrl && type ? chara(type.code) : null;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 280,
        padding: '18px 16px',
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 24,
        background: g ? g.light : color.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ display: 'block', width: 140, height: 210, objectFit: 'contain', objectPosition: 'center bottom' }} />
      ) : (
        ch && <img src={ch.framed} alt="" style={{ display: 'block', width: 140, height: 210, objectFit: 'contain', objectPosition: 'center bottom' }} />
      )}
      <div style={{ marginTop: 8 }}>{type && <TypeLabel code={type.code} />}</div>
      {!type && characterName && <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{characterName}</p>}
      {nickname && <p style={{ margin: '4px 0 0', fontSize: 13, color: color.sub }}>{nickname}さんの結果</p>}
    </div>
  );
}
