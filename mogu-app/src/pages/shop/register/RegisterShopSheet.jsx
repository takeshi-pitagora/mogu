import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { fetchShopQuota } from '../../../lib/shops';
import { emptyForm, stepDone, todayKey } from '../../../lib/registerForm';
import RegisterSheet from '../../../components/ui/RegisterSheet';
import ConfirmSheet from '../../../components/ui/ConfirmSheet';
import Button from '../../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../../components/ui/States';
import ShopNameStep, { AlreadyRegistered } from './ShopNameStep';
import useShopCandidates from './useShopCandidates';
import StationStep, { StationPicker } from './StationStep';
import GenreStep from './GenreStep';
import VisitBudgetStep, { VisitCalendar } from './VisitBudgetStep';
import PhotosStep from './PhotosStep';
import HighlightStep from './HighlightStep';
import { StepHint } from './StepFrame';

// =============================================================
// お店を登録する（⑰⑱⑲）確定版 Final-17・Final-18・Final-19
//   ⑯の＋・ホームの［お店を登録する］から開く。1つのシートの中で進む
//   開いたときに今日の上限を見て、こえていれば⑮の空の画面の形で知らせる
//   入力欄は必ず空から始める（ほかのサービスの店名で埋めない）
// =============================================================

// 進む順（必須は1画面に1問）
const FLOW = ['name', 'station', 'genre', 'visit', 'photos', 'highlight'];

export default function RegisterShopSheet({ onClose, onOpenShop, onAddPhoto }) {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null); // null = まだ読んでいない
  const [quotaError, setQuotaError] = useState(false);
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState('name');
  const [form, setForm] = useState(() => emptyForm());
  // 「登録済みのお店を確かめました」を押したときの名前。今の名前と同じあいだだけ有効
  const [checkedName, setCheckedName] = useState(null);
  const [picked, setPicked] = useState(null);
  const [askClose, setAskClose] = useState(false);
  const [openPicker, setOpenPicker] = useState(null); // station | calendar
  const [photoNoticeShown, setPhotoNoticeShown] = useState(false);

  const checked = checkedName != null && checkedName === form.name.trim();
  const search = useShopCandidates(form.name, checked);
  const change = (patch) => setForm((f) => ({ ...f, ...patch }));

  // 予算感を入れたことがない人にだけ「あなたは」を聞く（§6-6）
  const askGender = !user?.budgetGender;

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
  const touched = form.name.trim().length > 0 || form.station || form.photos.length > 0;
  const requestClose = () => {
    if (touched) setAskClose(true);
    else onClose();
  };

  const goBack = () => {
    const i = FLOW.indexOf(step);
    if (step === 'exists') setStep('name');
    else if (i > 0) setStep(FLOW[i - 1]);
  };
  const goNext = () => {
    const i = FLOW.indexOf(step);
    if (i >= 0 && i < FLOW.length - 1) setStep(FLOW[i + 1]);
    else setStep('optional'); // 任意（手順3の次）
  };

  // ------ 中身とボタンを決める ------
  let body = null;
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
    onBack = goBack;
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
  } else if (step === 'name') {
    body = (
      <ShopNameStep
        name={form.name}
        onChangeName={(v) => change({ name: v })}
        checked={checked}
        onConfirmChecked={() => setCheckedName(form.name.trim())}
        onPickExisting={(shop) => {
          setPicked(shop);
          setStep('exists');
        }}
        search={search}
      />
    );
    footer = (
      <Button variant="primary" onClick={goNext} disabled={!search.canGoNext}>
        次へ
      </Button>
    );
  } else {
    onBack = goBack;
    const done = stepDone(form, step);

    if (step === 'station') {
      body = <StationStep form={form} onChange={change} onOpenPicker={() => setOpenPicker('station')} />;
      footer = (
        <>
          {!done && <StepHint>駅を選び、歩く時間を入れてください</StepHint>}
          <Button variant="primary" onClick={goNext} disabled={!done}>
            次へ
          </Button>
        </>
      );
    } else if (step === 'genre') {
      body = <GenreStep form={form} onChange={change} />;
      footer = (
        <Button variant="primary" onClick={goNext} disabled={!done}>
          次へ
        </Button>
      );
    } else if (step === 'visit') {
      body = (
        <VisitBudgetStep
          form={form}
          onChange={change}
          askGender={askGender}
          onOpenCalendar={() => setOpenPicker('calendar')}
        />
      );
      footer = (
        <Button variant="primary" onClick={goNext} disabled={!done || (askGender && !form.gender)}>
          次へ
        </Button>
      );
    } else if (step === 'photos') {
      body = (
        <PhotosStep
          form={form}
          onChange={change}
          noticeShown={photoNoticeShown}
          onNoticeShown={() => setPhotoNoticeShown(true)}
        />
      );
      footer = (
        <>
          {!done && <StepHint>1枚以上足してください</StepHint>}
          <Button variant="primary" onClick={goNext} disabled={!done}>
            次へ
          </Button>
        </>
      );
    } else if (step === 'highlight') {
      body = <HighlightStep form={form} onChange={change} />;
      footer = (
        <Button variant="primary" onClick={goNext} disabled={!done}>
          次へ
        </Button>
      );
    }
  }

  return (
    <>
      <RegisterSheet title="お店を登録する" onClose={requestClose} onBack={onBack} footer={footer}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>{body}</div>
      </RegisterSheet>

      {openPicker === 'station' && (
        <StationPicker
          onPick={(st) => {
            change({ station: st });
            setOpenPicker(null);
          }}
          onCancel={() => setOpenPicker(null)}
        />
      )}

      {openPicker === 'calendar' && (
        <VisitCalendar
          value={form.visitedOn || todayKey()}
          onDone={(key) => {
            change({ visitedOn: key });
            setOpenPicker(null);
          }}
          onCancel={() => setOpenPicker(null)}
        />
      )}

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
