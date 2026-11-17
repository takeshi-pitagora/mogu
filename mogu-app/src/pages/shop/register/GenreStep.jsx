import { GENRES } from '../../../lib/registerForm';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import StepFrame from './StepFrame';

// ⑱-3 必須2：ジャンル（確定版 Final-18 の3）
//   1つ目がメイン、2つ目がサブ。2つ選ぶとほかは押せない
export default function GenreStep({ form, onChange }) {
  const { genreMain, genreSub } = form;
  const full = !!genreMain && !!genreSub;

  const toggle = (g) => {
    if (g === genreMain) {
      // メインを外す。サブがあればサブがメインになる
      onChange({ genreMain: genreSub || null, genreSub: null });
    } else if (g === genreSub) {
      onChange({ genreSub: null });
    } else if (!genreMain) {
      onChange({ genreMain: g });
    } else if (!genreSub) {
      onChange({ genreSub: g });
    }
  };

  return (
    <StepFrame form={form} title="ジャンルは？" note="メイン1つ＋サブ1つまで（2つ目に押したものがサブ）">
      <ChipRow style={{ marginTop: 10 }}>
        {GENRES.map((g) => {
          const isMain = g === genreMain;
          const isSub = g === genreSub;
          return (
            <ChoiceChip
              key={g}
              selected={isMain || isSub}
              disabled={full}
              note={isMain ? 'メイン' : isSub ? 'サブ' : null}
              onClick={() => toggle(g)}
            >
              {g}
            </ChoiceChip>
          );
        })}
      </ChipRow>
    </StepFrame>
  );
}
