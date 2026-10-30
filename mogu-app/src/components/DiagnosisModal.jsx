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

  // 回答済みマスの色：A側（0・1）はオレンジ、B側（2・3）はグリーン
  const cellStyle = (q, i) => {
    const v = answers[q.id];
    if (i === current) return { background: '#1E1C1A', border: '2.5px solid #E9D08A' };
    if (Number.isInteger(v)) return { background: v <= 1 ? '#E8A07E' : '#6FA88C', border: '2px solid #1E1C1A' };
    return { border: '1.5px dashed #5A564F' };
  };

  // 選ばれている選択肢は、黄色の縁取りで分かるようにする
  const ring = (score) => (selected === score ? { outline: '3px solid #E9D08A', outlineOffset: '2px' } : {});

  // 質問ごとにキャラを入れ替える（16キャラを順番に）
  const guideAvatar = getAvatarSrc(`avatar-${String((current % 16) + 1).padStart(2, '0')}`);
  const remaining = total - answeredCount;

  return (
    // 診断画面（デザイン案A：mogutype.com のダーク画面を再現）
    <div className="fixed inset-0 z-[60] bg-[#2E2C2A] flex justify-center text-[#FFFBF2]">
      <div
        className="relative w-full sm:max-w-sm h-full flex flex-col overflow-hidden"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)', paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
      >
        {/* 背景の大きな文字 */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-3 top-32 text-[150px] font-black leading-[0.85] tracking-[-4px] text-[rgba(233,208,138,0.06)]">
          MOGU<br />TYPE<br />MOGU
        </div>

        {/* ヘッダー */}
        <div className="relative flex items-center justify-between px-5 pb-3">
          <button onClick={onClose} className="py-2.5 text-sm font-extrabold text-[#CFC6B4]">閉じる</button>
          {!result && (
            <span className="rounded-full border-[2.5px] border-[#E9D08A] px-4 py-1.5 text-sm font-black text-[#E9D08A]">
              {remaining === 0 ? '全問回答済み！' : `あと${remaining}問！`}
            </span>
          )}
        </div>

        {!result ? (
          <div className="relative flex-1 min-h-0 overflow-y-auto px-5 flex flex-col gap-[18px]">
            {/* 進み具合：20マス（タップでその質問へ戻れる） */}
            <div aria-label={`${total}問中${answeredCount}問回答済み`} className="grid grid-cols-10 gap-1.5">
              {QUESTIONS.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => !locked && setCurrent(i)}
                  aria-label={`Q${i + 1}${Number.isInteger(answers[q.id]) ? '（回答済み）' : ''}`}
                  className="h-3.5 rounded-[5px]"
                  style={cellStyle(q, i)}
                />
              ))}
            </div>

            {/* キャラ＋吹き出しの質問 */}
            <div className="mt-2.5 flex items-center gap-1.5">
              <img src={guideAvatar} alt="" className="w-[108px] h-[108px] object-contain flex-none" />
              <div className="flex-1 bg-[#FFFBF2] text-[#2E2C2A] border-[3px] border-[#1E1C1A] rounded-[22px] px-[18px] py-4 shadow-[0_6px_0_#B5603F]">
                <p className="mb-1 text-xs font-extrabold text-[#7A7266]">Q{current + 1}・{axis.name}</p>
                <h3 className="text-[19px] font-black leading-[1.45]">{question.question}</h3>
              </div>
            </div>

            {/* 選択肢：A ／ どちらかといえばA ／ どちらかといえばB ／ B */}
            <div className="mt-1.5 flex flex-col gap-3.5">
              <button onClick={() => answer(0)} aria-pressed={selected === 0} style={ring(0)}
                className="text-left text-[17px] font-black text-[#2E2C2A] bg-[#E8A07E] border-[3px] border-[#1E1C1A] rounded-2xl px-5 py-[18px] shadow-[0_6px_0_#1E1C1A] active:translate-y-1 active:shadow-[0_2px_0_#1E1C1A] transition">
                {question.leftText}
              </button>
              <button onClick={() => answer(1)} aria-pressed={selected === 1} style={ring(1)} aria-label={`どちらかといえば、${question.leftText}`}
                className="text-left text-[15px] font-black text-[#F6D5C4] bg-[#262422] border-[3px] border-[#E8A07E] rounded-2xl px-5 py-3.5 shadow-[0_6px_0_#B5603F] active:translate-y-1 active:shadow-[0_2px_0_#B5603F] transition">
                どちらかといえば
              </button>
              <button onClick={() => answer(2)} aria-pressed={selected === 2} style={ring(2)} aria-label={`どちらかといえば、${question.rightText}`}
                className="text-left text-[15px] font-black text-[#CFEADB] bg-[#262422] border-[3px] border-[#6FA88C] rounded-2xl px-5 py-3.5 shadow-[0_6px_0_#3F7A61] active:translate-y-1 active:shadow-[0_2px_0_#3F7A61] transition">
                どちらかといえば
              </button>
              <button onClick={() => answer(3)} aria-pressed={selected === 3} style={ring(3)}
                className="text-left text-[17px] font-black text-[#1C2A23] bg-[#6FA88C] border-[3px] border-[#1E1C1A] rounded-2xl px-5 py-[18px] shadow-[0_6px_0_#1E1C1A] active:translate-y-1 active:shadow-[0_2px_0_#1E1C1A] transition">
                {question.rightText}
              </button>
            </div>

            <div className="mt-auto pt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0 || locked}
                className="text-[15px] font-black bg-[#2E2C2A] border-[2.5px] border-[#CFC6B4] rounded-2xl px-[34px] py-3 disabled:opacity-30"
              >
                ← 一つ前へ
              </button>
              <span className="text-[10px] font-medium text-[#7A7266]">提供: Mogu Type</span>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 overflow-y-auto px-5">
            {/* 結果：チケット風カード */}
            <div className="bg-[#FFFBF2] text-[#2E2C2A] border-[3px] border-[#1E1C1A] rounded-[22px] shadow-[0_6px_0_#B5603F] overflow-hidden mb-5">
              <div className="bg-[#3F7A61] text-[#FFFBF2] flex justify-between px-4 py-[7px] text-[11px] font-black tracking-[0.14em]">
                <span>MOGU TYPE</span><span>診断結果</span>
              </div>
              <div className="flex flex-col items-center text-center px-4 pt-3 pb-4">
                <p className="text-4xl font-black tracking-[0.06em] leading-none">{result.code}</p>
                <img src={getAvatarSrc(result.type.avatarId)} alt={result.type.name} className="w-36 h-36 object-contain" />
                <h3 className="text-2xl font-black mb-1">{result.type.name}</h3>
                <p className="text-sm font-bold mb-3">{result.type.line}</p>
                <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                  {result.type.tags.map((t) => (
                    <span key={t} className="text-[11px] font-black bg-[#EFE9DF] px-2.5 py-0.5 rounded-full">#{t}</span>
                  ))}
                </div>
                <p className="text-xs text-[#6B6359] leading-relaxed">{result.type.short}</p>
              </div>
            </div>

            {/* 4軸のバー */}
            <div className="bg-[#262422] rounded-3xl border-2 border-[#5A564F] p-4 space-y-3.5 mb-4">
              {AXES.map((a) => {
                const v = result.axes[a.key];
                const leftSide = v < 1.5;
                return (
                  <div key={a.key}>
                    <p className="text-[10px] font-bold text-[#CFC6B4] mb-1">{a.name}</p>
                    <div className="flex items-center gap-2 text-[11px] font-black">
                      <span className={`w-16 text-right ${leftSide ? 'text-[#E8A07E]' : 'text-[#7A7266]'}`}>{a.leftLabel}</span>
                      <div className="relative flex-1 h-2 rounded-full bg-[#3A3734]">
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#1E1C1A]"
                          style={{ left: `${(v / 3) * 100}%`, background: leftSide ? '#E8A07E' : '#6FA88C' }}
                        />
                      </div>
                      <span className={`w-16 ${!leftSide ? 'text-[#6FA88C]' : 'text-[#7A7266]'}`}>{a.rightLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] font-bold text-center mb-4 min-h-[1rem]">
              {saveState === 'saving' && <span className="text-[#CFC6B4]">プロフィールに保存しています…</span>}
              {saveState === 'saved' && <span className="text-[#6FA88C]">マイページのキャラとタイプに反映しました</span>}
              {saveState === 'local' && <span className="text-[#CFC6B4]">ゲストのため保存されません。登録すると結果を残せます</span>}
              {saveState === 'error' && <span className="text-[#F08A80]">保存できませんでした。時間をおいてもう一度お試しください</span>}
            </p>

            <div className="space-y-3 pb-2">
              <button onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[#E8A07E] text-[#2E2C2A] text-[15px] font-black border-[3px] border-[#1E1C1A] shadow-[0_5px_0_#1E1C1A]">
                {user?.isGuest ? '閉じる' : 'マイページに戻る'}
              </button>
              <button onClick={restart} className="w-full py-3 rounded-2xl border-[2.5px] border-[#CFC6B4] text-sm font-black">
                もう一度診断する
              </button>
              <button
                onClick={() => window.open(TYPE_DETAIL_URL(result.code), '_blank', 'noopener,noreferrer')}
                className="w-full py-2 text-[11px] font-bold text-[#E9D08A] underline"
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
