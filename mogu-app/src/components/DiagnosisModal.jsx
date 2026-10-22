import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAvatarSrc } from '../assets/avatars/avatars';
import { AXES, QUESTIONS, calculateDiagnosis, getType, TYPE_DETAIL_URL } from '../lib/mogutype';

// Mogu Type 食スタイル診断（20問）。結果はプロフィールのタイプ・アイコンに反映する
export default function DiagnosisModal({ onClose, onResult }) {
  const { user, saveDiagnosis } = useAuth();
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState(null); // { code, axes, type }
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | local | error

  const total = QUESTIONS.length;
  const answeredCount = QUESTIONS.filter((x) => Number.isInteger(answers[x.id])).length;
  const question = QUESTIONS[current];
  const axis = AXES.find((a) => a.key === question.axis);
  const selected = answers[question.id];

  const finish = async (finalAnswers) => {
    const r = calculateDiagnosis(finalAnswers);
    if (!r) return;
    const type = getType(r.code);
    setResult({ ...r, type });
    onResult?.({ code: r.code, axes: r.axes, avatarId: type.avatarId });
    setSaveState('saving');
    const { error, localOnly } = await saveDiagnosis({ code: r.code, axes: r.axes, avatarId: type.avatarId });
    setSaveState(error ? 'error' : localOnly ? 'local' : 'saved');
  };

  const answer = (score) => {
    if (locked) return;
    const next = { ...answers, [question.id]: score };
    setAnswers(next);
    setLocked(true);
    setTimeout(() => {
      setLocked(false);
      // 次の未回答へ進む（後ろに無ければ先頭から探す）。全問答えたら結果へ
      const unanswered = (i) => !Number.isInteger(next[QUESTIONS[i].id]);
      const after = QUESTIONS.findIndex((_, i) => i > current && unanswered(i));
      const any = QUESTIONS.findIndex((_, i) => unanswered(i));
      if (any === -1) finish(next);
      else setCurrent(after !== -1 ? after : any);
    }, 180);
  };

  const restart = () => {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setSaveState('idle');
  };

  const choiceClass = (score) =>
    `w-full rounded-2xl border-2 text-sm font-bold transition active:scale-[0.98] ${
      selected === score ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-[#EFE9DF] text-stone-800'
    }`;

  return (
    <div className="fixed inset-0 z-[60] bg-[#FBF7F0] flex justify-center">
      <div
        className="w-full sm:max-w-sm h-full flex flex-col"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)', paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pb-3">
          <button onClick={onClose} className="text-stone-500 font-bold text-sm">閉じる</button>
          <h2 className="font-black text-base text-stone-900">食スタイル診断</h2>
          <span className="w-10" />
        </div>

        {!result ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 flex flex-col">
            {/* 進み具合 */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1.5">
                <span>Q{current + 1} / {total}</span>
                <span>{answeredCount === total ? '全問回答済み！' : `あと${total - answeredCount}問`}</span>
              </div>
              <div className="h-2 rounded-full bg-[#EFE9DF] overflow-hidden">
                <div className="h-full bg-stone-900 rounded-full transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
              </div>
            </div>

            <span className="self-start text-[10px] font-bold text-stone-600 bg-[#EFE9DF] px-3 py-1 rounded-full mb-3">
              {axis.name}
            </span>
            <h3 className="text-lg font-black text-stone-900 leading-snug mb-6">{question.question}</h3>

            {/* 選択肢：A ／ どちらかといえばA ／ どちらかといえばB ／ B */}
            <div className="flex flex-col gap-2.5">
              <button onClick={() => answer(0)} className={`${choiceClass(0)} px-4 py-4 text-left`} aria-pressed={selected === 0}>
                {question.leftText}
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => answer(1)} className={`${choiceClass(1)} px-3 py-3`} aria-pressed={selected === 1} aria-label={`どちらかといえば、${question.leftText}`}>
                  ↑ どちらかといえば
                </button>
                <button onClick={() => answer(2)} className={`${choiceClass(2)} px-3 py-3`} aria-pressed={selected === 2} aria-label={`どちらかといえば、${question.rightText}`}>
                  どちらかといえば ↓
                </button>
              </div>
              <button onClick={() => answer(3)} className={`${choiceClass(3)} px-4 py-4 text-left`} aria-pressed={selected === 3}>
                {question.rightText}
              </button>
            </div>

            <div className="mt-auto pt-6 flex justify-between">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0 || locked}
                className="text-xs font-bold text-stone-500 disabled:opacity-30"
              >
                ← 前の質問
              </button>
              <span className="text-[10px] text-stone-400 font-medium">提供: Mogu Type</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5">
            {/* 結果 */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md bg-white mb-3">
                <img src={getAvatarSrc(result.type.avatarId)} alt={result.type.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] font-black tracking-widest text-stone-400">{result.code}</p>
              <h3 className="text-2xl font-black text-stone-900 mb-1">{result.type.name}</h3>
              <p className="text-sm font-bold text-stone-700 mb-3">{result.type.line}</p>
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {result.type.tags.map((t) => (
                  <span key={t} className="text-[10px] font-bold text-stone-600 bg-[#EFE9DF] px-2.5 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
              <p className="text-xs text-stone-600 leading-relaxed mb-5">{result.type.short}</p>
            </div>

            {/* 4軸のバー */}
            <div className="bg-white rounded-3xl border border-[#F0EAE0] p-4 space-y-3.5 mb-4">
              {AXES.map((a) => {
                const v = result.axes[a.key];
                const leftSide = v < 1.5;
                return (
                  <div key={a.key}>
                    <p className="text-[10px] font-bold text-stone-400 mb-1">{a.name}</p>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className={`w-16 text-right ${leftSide ? 'text-stone-900' : 'text-stone-400'}`}>{a.leftLabel}</span>
                      <div className="relative flex-1 h-2 rounded-full bg-[#EFE9DF]">
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-stone-900 border-2 border-white shadow"
                          style={{ left: `${(v / 3) * 100}%` }}
                        />
                      </div>
                      <span className={`w-16 ${!leftSide ? 'text-stone-900' : 'text-stone-400'}`}>{a.rightLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] font-bold text-center mb-4 min-h-[1rem]">
              {saveState === 'saving' && <span className="text-stone-400">プロフィールに保存しています…</span>}
              {saveState === 'saved' && <span className="text-emerald-600">プロフィールのアイコンとタイプに反映しました</span>}
              {saveState === 'local' && <span className="text-stone-500">ゲストのため保存されません。登録すると結果を残せます</span>}
              {saveState === 'error' && <span className="text-red-500">保存できませんでした。時間をおいてもう一度お試しください</span>}
            </p>

            <div className="space-y-2 pb-2">
              <button onClick={onClose} className="w-full py-3 rounded-2xl bg-stone-900 text-white text-sm font-bold">
                {user?.isGuest ? '閉じる' : 'プロフィールに戻る'}
              </button>
              <button onClick={restart} className="w-full py-3 rounded-2xl border border-stone-200 text-xs font-bold text-stone-600">
                もう一度診断する
              </button>
              <button
                onClick={() => window.open(TYPE_DETAIL_URL(result.code), '_blank', 'noopener,noreferrer')}
                className="w-full py-2 text-[11px] font-bold text-amber-800 underline"
              >
                {result.type.name}の詳しい解説を見る（mogutype.com）
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
