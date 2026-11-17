import { useEffect, useState } from 'react';
import { fetchShopQuota } from '../../../lib/shops';
import RegisterSheet from '../../../components/ui/RegisterSheet';
import ConfirmSheet from '../../../components/ui/ConfirmSheet';
import Button from '../../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../../components/ui/States';
import ShopNameStep, { AlreadyRegistered } from './ShopNameStep';
import useShopCandidates from './useShopCandidates';

// =============================================================
// お店を登録する（⑰⑱⑲）確定版 Final-17・Final-18・Final-19
//   ⑯の＋・ホームの［お店を登録する］から開く。1つのシートの中で進む
//   開いたときに今日の上限を見て、こえていれば⑮の空の画面の形で知らせる
//   入力欄は必ず空から始める（ほかのサービスの店名で埋めない）
// =============================================================

export default function RegisterShopSheet({ onClose, onOpenShop, onAddPhoto }) {
  const [quota, setQuota] = useState(null); // null = まだ読んでいない
  const [quotaError, setQuotaError] = useState(false);
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState('name'); // name | exists | info
  const [name, setName] = useState('');
  // 「登録済みのお店を確かめました」を押したときの名前。今の名前と同じあいだだけ有効
  const [checkedName, setCheckedName] = useState(null);
  const [picked, setPicked] = useState(null);
  const [askClose, setAskClose] = useState(false);

  const checked = checkedName != null && checkedName === name.trim();
  const search = useShopCandidates(name, checked);

  useEffect(() => {
    let alive = true;
    fetchShopQuota()
      .then((q) => {
        if (alive) setQuota(q);
      })
      .catch(() => {
        if (alive) setQuotaError(true);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  const retryQuota = () => {
    setQuota(null);
    setQuotaError(false);
    setReload((n) => n + 1);
  };

  // ×：何か入れていたら確かめる。何も入れていなければそのまま閉じる
  const requestClose = () => {
    if (name.trim().length > 0) setAskClose(true);
    else onClose();
  };

  // ------ 中身とボタンを決める ------
  let body;
  let footer = null;
  let onBack = null;

  if (quotaError) {
    body = <ErrorState kind="offline" onRetry={retryQuota} style={{ flex: 1, paddingBottom: 40 }} />;
  } else if (!quota) {
    body = <LoadingState style={{ flex: 1, paddingBottom: 40 }} />;
  } else if (quota.suspended) {
    // ㉗（手順6）で「いつまで」を出す。ここでは止めるだけ
    body = (
      <EmptyState
        title={'いまは投稿が\nできません'}
        description="お知らせを見てください。"
        actions={[{ label: '閉じる', onClick: onClose }]}
        style={{ flex: 1, paddingBottom: 40 }}
      />
    );
  } else if (quota.left <= 0) {
    body = (
      <EmptyState
        title={`今日登録できるのは\n${quota.limit}店までです`}
        description="また明日お願いします。"
        actions={[{ label: '閉じる', onClick: onClose }]}
        style={{ flex: 1, paddingBottom: 40 }}
      />
    );
  } else if (step === 'exists' && picked) {
    onBack = () => setStep('name');
    body = <AlreadyRegistered shop={picked} />;
    footer = (
      <>
        <Button variant="primary" onClick={() => onAddPhoto?.(picked)}>
          写真を足す
        </Button>
        <Button variant="secondary" onClick={() => onOpenShop?.(picked)} style={{ marginTop: 10 }}>
          このお店を見る
        </Button>
      </>
    );
  } else {
    body = (
      <ShopNameStep
        name={name}
        onChangeName={setName}
        checked={checked}
        onConfirmChecked={() => setCheckedName(name.trim())}
        onPickExisting={(shop) => {
          setPicked(shop);
          setStep('exists');
        }}
        search={search}
      />
    );
    footer = (
      <Button variant="primary" onClick={() => setStep('info')} disabled={!search.canGoNext}>
        次へ
      </Button>
    );
  }

  return (
    <>
      <RegisterSheet title="お店を登録する" onClose={requestClose} onBack={onBack} footer={footer}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>{body}</div>
      </RegisterSheet>

      <ConfirmSheet
        open={askClose}
        title="登録をやめますか？"
        description="入力した内容は消えます。"
        actionLabel="やめる"
        danger
        onConfirm={onClose}
        onCancel={() => setAskClose(false)}
        height={250}
      />
    </>
  );
}
