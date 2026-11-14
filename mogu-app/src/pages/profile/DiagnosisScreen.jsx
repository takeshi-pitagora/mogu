import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { getType } from '../../lib/mogutype';
import { AXIS_CARD, AXIS_LABELS, AXIS_META, axisHeading, axisPercent } from '../../lib/axis';
import { DIAGNOSE_URL, fetchMoguTypeResult, MYPAGE_URL } from '../../lib/mogutypeApi';
import { openExternal } from '../../lib/open';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import MoguTypeCard from '../../components/ui/MoguTypeCard';
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

// 連携済み（確定版 Final-06）。4軸カード4枚（軸名・番号・見出し・％・バー）。パスのNo.は出さない（4回目 §3-2・§4-2）
function LinkedView({ user, busy, onRefresh, onUnlink }) {
  const type = getType(user.moguType.code);
  const detailUrl = user.moguType.detailUrl || MYPAGE_URL;
  const date = user.moguType.linkedAt ? new Date(user.moguType.linkedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日に連携` : '';
  const axes = user.moguType.axisValues;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <MoguTypeCard code={type?.code} characterName={user.moguType.characterName} nickname={user.moguType.nickname} completedAt={user.moguType.completedAt} />
      {axes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 0, width: '100%' }}>
          <h2 style={{ margin: '22px 0 -4px', textAlign: 'left', fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>4つの軸</h2>
          {AXIS_META.map((m, i) => {
            const label = AXIS_LABELS[i];
            const { left, right } = axisPercent(axes[m.key] ?? 1.5);
            const leftStrong = left >= right;
            return (
              <AxisCard key={m.key} meta={m} label={label} left={left} right={right} leftStrong={leftStrong} heading={axisHeading(m.key, leftStrong, leftStrong ? left : right)} />
            );
          })}
        </div>
      )}
      {dateText && <p style={{ margin: '18px 0 0', fontSize: 12, color: color.sub }}>{dateText}</p>}
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
      <MoguTypeCard code={result.typeCode} characterName={result.characterName} nickname={result.nickname} completedAt={result.completedAt} imageUrl={result.imageUrl} style={{ marginTop: 18 }} />
      <p style={{ margin: '22px 0 0', fontFamily: font.dela, fontSize: 18 }}>この結果を mogu で使いますか？</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, width: '100%' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
          やめる
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy} style={{ flex: 1 }}>
          使う
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

// 4軸のカード（確定版 Final-06-4〜6 の HTML のとおり）
//   地は黒（#2E2C2A）、軸ごとの色（01 緑・02 テラコッタ・03 モーブ・04 金）、
//   右上に白抜きの番号（Dela 54・横 0.78 につぶす）、色付きの軸名、Dela 21 の見出し、
//   強い側の大きな％（Dela 46・ずれた影）、6つに区切ったバーと赤いピン
function AxisCard({ meta, label, left, right, leftStrong, heading }) {
  const strongPercent = leftStrong ? left : right;
  const weakPercent = leftStrong ? right : left;
  const strongLabel = leftStrong ? label.left : label.right;
  const weakLabel = leftStrong ? label.right : label.left;
  // ピンは「左の端＝左の文字そのもの」の目盛りの上に立つ。値（0〜3）の位置＝右の％
  const pinAt = right;
  const seg = [meta.main, meta.mid, meta.pale, meta.pale, meta.mid, meta.main];
  return (
    <section style={{ position: 'relative', textAlign: 'left', boxSizing: 'border-box', padding: '18px 20px 20px', border: `${stroke.shape}px solid ${AXIS_CARD.border}`, borderRadius: 28, background: AXIS_CARD.bg, color: AXIS_CARD.text }}>
      <span
        aria-hidden="true"
        style={{ position: 'absolute', right: 16, top: 10, fontFamily: font.dela, fontSize: 54, lineHeight: 1, color: 'transparent', WebkitTextStroke: `2px ${meta.outline}`, transform: 'scaleX(0.78)', transformOrigin: 'right top' }}
      >
        {meta.number}
      </span>
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 10, background: meta.main, fontSize: 14, fontWeight: 700 }}>{meta.badge}</span>
      <h3 style={{ position: 'relative', margin: '10px 0 0', paddingRight: 64, fontFamily: font.dela, fontSize: 21, fontWeight: 400, lineHeight: 1.3 }}>{heading}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{strongLabel}</span>
          <span style={{ fontFamily: font.dela, fontSize: 46, lineHeight: 1, color: AXIS_CARD.number, textShadow: `3px 3px 0 ${meta.main}` }}>{strongPercent}</span>
          <span style={{ fontFamily: font.dela, fontSize: 16, color: AXIS_CARD.number }}>%</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: AXIS_CARD.weak }}>
          {weakPercent}% {weakLabel}
        </span>
      </div>
      <div style={{ position: 'relative', paddingTop: 30, marginTop: 2 }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: `calc(${pinAt}% - 10px)` }}>
          <svg width="30" height="44" viewBox="0 0 30 44">
            <path d="M10 42 19.5 15" stroke="#C9C2B8" strokeWidth="3" />
            <circle cx="20" cy="12" r="10" fill={color.red} stroke={color.ink} strokeWidth="2" />
            <circle cx="16.5" cy="8.5" r="3" fill="#FFFFFF" fillOpacity="0.8" />
          </svg>
        </span>
        <div aria-hidden="true" style={{ display: 'flex', height: 22, boxSizing: 'border-box', border: `3px solid ${color.white}`, borderRadius: 11, overflow: 'hidden' }}>
          {seg.map((bg, i) => (
            <span key={i} style={{ flex: 1, background: bg, borderLeft: i === 0 ? 0 : `2px solid ${color.ink}` }} />
          ))}
        </div>
      </div>
    </section>
  );
}

