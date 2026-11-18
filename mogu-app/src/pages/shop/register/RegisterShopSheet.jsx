import { useEffect, useState } from 'react';
import { color, font } from '../../../theme/tokens';
import { useAuth } from '../../../context/AuthContext';
import { clearDraft, fetchShopQuota, loadDraft, registerErrorMessage, saveDraft } from '../../../lib/shops';
import { emptyForm, missingLabels, stepDone, todayKey } from '../../../lib/registerForm';
import RegisterSheet from '../../../components/ui/RegisterSheet';
import ConfirmSheet from '../../../components/ui/ConfirmSheet';
import BottomSheet, { SheetTitle } from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../../components/ui/States';
import ShopNameStep, { AlreadyRegistered } from './ShopNameStep';
import useShopCandidates from './useShopCandidates';
import StationStep, { StationPicker } from './StationStep';
import GenreStep from './GenreStep';
import VisitBudgetStep, { VisitCalendar } from './VisitBudgetStep';
import PhotosStep from './PhotosStep';
import HighlightStep from './HighlightStep';
import OptionalStep from './OptionalStep';
import ConfirmStep from './ConfirmStep';
import { blockingLabels } from '../../../lib/registerBlocking';
import TagPickSheet from './TagPickSheet';
import { StepHint } from './StepFrame';
import { draftBody, submitRegistration } from './submit';

// =============================================================
// お店を登録する（⑰⑱⑲）確定版 Final-17・Final-18・Final-19
//   ⑯の＋・ホームの［お店を登録する］から開く。1つのシートの中で進む
//   入力欄は必ず空から始める（ほかのサービスの店名で埋めない）
// =============================================================

const FLOW = ['name', 'station', 'genre', 'visit', 'photos', 'highlight', 'optional', 'confirm'];

export default function RegisterShopSheet({ onClose, onOpenShop, onAddPhoto, onRegistered }) {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null);
  const [quotaError, setQuotaError] = useState(false);
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState('name');
  const [form, setForm] = useState(() => emptyForm());
  const [checkedName, setCheckedName] = useState(null);
  const [picked, setPicked] = useState(null);
  const [askClose, setAskClose] = useState(false);
  const [openPicker, setOpenPicker] = useState(null); // station | calendar | tags
  const [photoNoticeShown, setPhotoNoticeShown] = useState(false);
  const [draft, setDraft] = useState(null); // 下書きがあります（⑰-17）
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const checked = checkedName != null && checkedName === form.name.trim();
  const search = useShopCandidates(form.name, checked);
  const change = (patch) => setForm((f) => ({ ...f, ...patch }));

  // 予算感を入れたことがない人にだけ「あなたは」を聞く（§6-6）
  const askGender = !user?.budgetGender;

  useEffect(() => {
    let alive = true;
    Promise.all([fetchShopQuota(), loadDraft()])
      .then(([q, d]) => {
        if (!alive) return;
        setQuota(q);
        if (d?.name) setDraft(d);
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

  const touched = form.name.trim().length > 0 || !!form.station || form.photos.length > 0;
  const requestClose = () => {
    if (touched) setAskClose(true);
    else onClose();
  };

  const keepDraft = async () => {
    setAskClose(false);
    try {
      await saveDraft(draftBody(form));
    } catch {
      /* 下書きが残せなくても閉じる */
    }
    onClose();
  };
  const dropDraft = async () => {
    setAskClose(false);
    try {
      await clearDraft();
    } catch {
      /* 何もしない */
    }
    onClose();
  };

  const goBack = () => {
    if (step === 'exists') {
      setStep('name');
      return;
    }
    const i = FLOW.indexOf(step);
    if (i > 0) setStep(FLOW[i - 1]);
  };
  const goNext = () => {
    const i = FLOW.indexOf(step);
    if (i >= 0 && i < FLOW.length - 1) setStep(FLOW[i + 1]);
  };

  const send = async () => {
    setSendError(null);
    setSending(true);
    try {
      const shopId = await submitRegistration(user.id, form);
      onRegistered?.(shopId, form);
    } catch (e) {
      setSendError(e);
    } finally {
      setSending(false);
    }
  };

  const continueDraft = () => {
    setForm({ ...emptyForm(), ...draft, photos: [] });
    setCheckedName(draft.name?.trim() ?? null);
    setDraft(null);
    setStep('station');
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
  } else if (sending) {
    // ⑱-18 登録中
    body = <LoadingState label="登録しています" style={{ flex: 1, paddingBottom: 40 }} />;
  } else if (sendError) {
    // ⑱-19 通信できないとき（入れた内容は消えない）
    body = (
      <EmptyState
        title="通信できません"
        description={`${registerErrorMessage(sendError)}\n入れた内容は消えていません。`}
        actions={[
          { label: 'もう一度送る', onClick: send },
          { label: '戻る', onClick: () => setSendError(null), variant: 'secondary' },
        ]}
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
      <>
        {draft && <DraftBar draft={draft} onContinue={continueDraft} />}
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
      </>
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
      body = <VisitBudgetStep form={form} onChange={change} askGender={askGender} onOpenCalendar={() => setOpenPicker('calendar')} />;
      footer = (
        <Button variant="primary" onClick={goNext} disabled={!done || (askGender && !form.gender)}>
          次へ
        </Button>
      );
    } else if (step === 'photos') {
      body = <PhotosStep form={form} onChange={change} noticeShown={photoNoticeShown} onNoticeShown={() => setPhotoNoticeShown(true)} />;
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
    } else if (step === 'optional') {
      body = <OptionalStep form={form} onChange={change} onOpenTags={() => setOpenPicker('tags')} />;
      footer = (
        <>
          <Button variant="primary" onClick={goNext}>
            登録の前の確認へ
          </Button>
          {missingLabels(form).length === 0 && (
            <Button variant="text" onClick={goNext} style={{ marginTop: 6 }}>
              任意を飛ばして確認へ
            </Button>
          )}
        </>
      );
    } else if (step === 'confirm') {
      const blocking = blockingLabels(form);
      body = <ConfirmStep form={form} onChange={change} />;
      footer = (
        <>
          {blocking.length > 0 && <StepHint>{`あと${blocking.length}つ：${blocking.join('・')}`}</StepHint>}
          <Button variant="primary" onClick={send} disabled={blocking.length > 0}>
            登録する
          </Button>
        </>
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

      {openPicker === 'tags' && (
        <TagPickSheet
          picked={form.tags}
          onDone={(tags) => {
            change({ tags });
            setOpenPicker(null);
          }}
          onCancel={() => setOpenPicker(null)}
        />
      )}

      {/* ⑱-16 途中で閉じる（×）。名前しか入れていないときは⑰の「やめますか？」 */}
      {step === 'name' ? (
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
      ) : (
        <BottomSheet open={askClose} onClose={() => setAskClose(false)} ariaLabel="下書きに残しますか？" minHeight={280}>
          <SheetTitle>下書きに残しますか？</SheetTitle>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, textAlign: 'left', color: color.sub }}>
            写真は残りません。次に開いたときに、続きから書けます。
          </p>
          <div style={{ flex: 1, minHeight: 0 }} />
          <Button variant="primary" onClick={keepDraft} style={{ marginTop: 18 }}>
            下書きに残す
          </Button>
          <Button variant="secondary" onClick={dropDraft} style={{ marginTop: 10 }}>
            消す
          </Button>
          <Button variant="text" onClick={() => setAskClose(false)} style={{ marginTop: 6 }}>
            キャンセル
          </Button>
        </BottomSheet>
      )}
    </>
  );
}

// ⑰-17 下書きがあります
function DraftBar({ draft, onContinue }) {
  const base = { ...emptyForm(), ...draft, photos: [] };
  const done = ['station', 'genre', 'visit', 'photos', 'highlight'].filter((s) => stepDone(base, s)).length;
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 14px', borderRadius: 18, background: color.surface }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: font.dela, fontSize: 14 }}>下書きがあります</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 700, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {draft.name}・必須 {done}/5
        </span>
      </span>
      <button
        type="button"
        onClick={onContinue}
        className="ui-btn"
        style={{ flex: 'none', height: 40, padding: '0 16px', border: 0, borderRadius: 20, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
      >
        続ける
      </button>
    </div>
  );
}
