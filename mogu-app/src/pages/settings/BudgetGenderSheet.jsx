import { useEffect, useState } from 'react';
import { color } from '../../theme/tokens';
import { GENDERS } from '../../lib/registerForm';
import { myBudgetGender, setMyBudgetGender } from '../../lib/shops';
import BottomSheet, { SheetTitle } from '../../components/ui/BottomSheet';
import Button from '../../components/ui/Button';
import { Radio } from '../../components/ui/Radio';

// ⑤ アカウント「予算感の性別」（引き渡し書 §9-1 の3）
//   ⑱ではじめて予算感を入れるときに1回だけ聞いたものを、あとから変える場所。
//   予算を男女別に出すためだけに使い、ほかの人には出さない。
export default function BudgetGenderSheet({ onClose }) {
  const [value, setValue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 出すときだけ作られるので、はじめに1回だけ今の値を読む
  useEffect(() => {
    let alive = true;
    myBudgetGender()
      .then((v) => alive && setValue(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await setMyBudgetGender(value);
      onClose();
    } catch {
      setError('いま変えられませんでした。少し待ってもう一度お願いします。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose} ariaLabel="予算感の性別" minHeight={420}>
      <SheetTitle>予算感の性別</SheetTitle>
      <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 500, lineHeight: 1.7, color: color.sub }}>
        予算を男女別に出すためだけに使います。ほかの人には出しません
      </p>
      <div style={{ marginTop: 14 }}>
        {GENDERS.map((g, i) => (
          <button
            key={g.value}
            type="button"
            role="radio"
            aria-checked={value === g.value}
            onClick={() => setValue(g.value)}
            className="ui-btn"
            style={{
              width: '100%',
              height: 60,
              padding: '0 2px',
              border: 0,
              borderTop: i === 0 ? `1px solid ${color.line}` : 0,
              borderBottom: `1px solid ${color.line}`,
              background: 'transparent',
              color: color.ink,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 500 }}>{g.label}</span>
            <Radio on={value === g.value} />
          </button>
        ))}
      </div>
      {error && (
        <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: color.red }}>{error}</p>
      )}
      <Button onClick={save} disabled={busy || !value} style={{ marginTop: 18 }}>
        変える
      </Button>
    </BottomSheet>
  );
}
