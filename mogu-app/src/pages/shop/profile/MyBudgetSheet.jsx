import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import BottomSheet from '../../../components/ui/BottomSheet';
import { BUDGET_BUCKETS, GENDERS, TIME_OF_DAY } from '../../../lib/registerForm';
import { myBudgetGender, setMyBudget, setMyBudgetGender } from '../../../lib/shops';

// =============================================================
// ⑱-24・25 ［自分の予算感を入れる］（2人目から）
//   金額は飲み物も入れたひとりぶん。昼・夜それぞれ1つで、入れ直すと入れ替わる。
//   性別は、はじめて入れるときだけ聞く。2回目からは
//   「男性として入れます ［変える］」だけ出す（§6-6）
// =============================================================

const GENDER_LABEL = { male: '男性', female: '女性', no_answer: '答えない' };

export default function MyBudgetSheet({ shopId, mine, onClose, onDone }) {
  const [time, setTime] = useState('dinner');
  const [bucket, setBucket] = useState(mine?.dinner ?? null);
  const [gender, setGender] = useState(undefined); // undefined = まだ読んでいない
  const [askGender, setAskGender] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    myBudgetGender()
      .then((g) => {
        if (!alive) return;
        setGender(g || null);
        if (!g) setAskGender(true); // はじめての人には聞く
      })
      .catch(() => alive && setGender(null));
    return () => { alive = false; };
  }, []);

  const pickTime = (v) => {
    setTime(v);
    setBucket(mine?.[v] ?? null);
  };

  const save = async () => {
    if (!bucket || busy) return;
    setBusy(true);
    setError('');
    try {
      if (askGender && gender) await setMyBudgetGender(gender);   // 「変える」でも入れ替わるように
      const res = await setMyBudget(shopId, time, bucket, gender || null);
      onDone?.(res);
      onClose?.();
    } catch (err) {
      console.error('予算感のエラー:', err?.message || err);
      setError('入れられませんでした。少しあとでもう一度おためしください');
      setBusy(false);
    }
  };

  const chip = (on) => ({
    minHeight: 48,
    padding: '0 18px',
    boxSizing: 'border-box',
    border: `${stroke.shape}px solid ${color.ink}`,
    borderRadius: 24,
    background: on ? color.ink : color.white,
    color: on ? color.white : color.ink,
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 700,
  });

  return (
    <BottomSheet open onClose={onClose} ariaLabel="予算感を入れる" maxHeight="88%">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
        <button type="button" onClick={onClose} className="ui-btn ui-btn--text" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
          キャンセル
        </button>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>予算感を入れる</h2>
        <span style={{ width: 74 }} />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: color.sub }}>金額は、飲み物も入れたひとりぶん</p>

      <h3 style={{ margin: '14px 0 0', fontSize: 15, fontWeight: 700 }}>行ったのは</h3>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {TIME_OF_DAY.map((t) => (
          <button key={t.value} type="button" className="ui-btn" aria-pressed={time === t.value} onClick={() => pickTime(t.value)} style={{ ...chip(time === t.value), width: 88, borderRadius: 28, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <h3 style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 700 }}>ひとりいくら？</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {BUDGET_BUCKETS.map((b) => (
          <button key={b.value} type="button" className="ui-btn" aria-pressed={bucket === b.value} onClick={() => setBucket(b.value)} style={chip(bucket === b.value)}>
            {b.label}
          </button>
        ))}
      </div>

      {/* はじめて入れる人にだけ聞く */}
      {askGender ? (
        <div style={{ marginTop: 18, padding: '14px 14px 16px', borderRadius: 18, background: color.surface }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>あなたは</div>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.6, color: color.sub }}>
            予算を男女別に出すためだけに使います。ほかの人には出しません
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {GENDERS.map((g) => (
              <button key={g.value} type="button" className="ui-btn" aria-pressed={gender === g.value} onClick={() => setGender(g.value)} style={chip(gender === g.value)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        gender !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, marginTop: 18, padding: '0 16px', borderRadius: 18, background: color.surface }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>{GENDER_LABEL[gender] || '答えない'}として入れます</span>
            <button
              type="button"
              className="ui-btn ui-btn--text"
              onClick={() => setAskGender(true)}
              style={{ flex: 'none', height: 44, padding: '0 2px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}
            >
              変える
            </button>
          </div>
        )
      )}

      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}

      <button
        type="button"
        className="ui-btn ui-btn--primary"
        disabled={!bucket || busy || (askGender && !gender)}
        onClick={save}
        style={{ width: '100%', height: 60, marginTop: 18, border: 0, borderRadius: 30, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, opacity: !bucket || busy || (askGender && !gender) ? 0.45 : 1 }}
      >
        入れる
      </button>
    </BottomSheet>
  );
}
