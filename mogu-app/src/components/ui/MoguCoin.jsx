import { color, font } from '../../theme/tokens';
import coinImg from '../../assets/coin/coin.webp';

// モグコイン（確定版 Final-20・Final-26・引き渡し書 第5回 §4）
//   ハリーの顔の銅のコイン。渡された画像をそのまま使う（描き直さない）
//     確定 … そのまま
//     仮   … 色を抜いて白っぽく（点線の輪はなし）
//     取消 … 灰色で薄く
//   大きさは 16・22・28・44・64
//   金色・メダル・紙吹雪・影は使わない（§4 の下の注）
const FILTER = {
  confirmed: undefined,
  pending: 'grayscale(1) brightness(1.32) contrast(.55)',
  cancelled: 'grayscale(1) brightness(1.18) contrast(.42)',
};
const OPACITY = { confirmed: 1, pending: 0.9, cancelled: 0.9 };

export default function MoguCoin({ size = 22, state = 'confirmed', style }) {
  return (
    <span
      aria-hidden="true"
      style={{ flex: 'none', position: 'relative', display: 'block', width: size, height: size, ...style }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: `url(${coinImg}) center/contain no-repeat`,
          filter: FILTER[state],
          opacity: OPACITY[state] ?? 1,
        }}
      />
    </span>
  );
}

// コインと数をならべたもの（⑳-1 の行の右、㉖の合計など）
export function CoinAmount({ amount, size = 20, state = 'confirmed', numberSize = 16, showPending = false }) {
  const sign = amount > 0 ? '＋' : '';
  return (
    <span aria-label={`モグコイン ${sign}${amount}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <MoguCoin size={size} state={state} />
      <span style={{ fontFamily: font.dela, fontSize: numberSize, lineHeight: 1, color: state === 'cancelled' ? color.sub : color.ink, textDecoration: state === 'cancelled' ? 'line-through' : 'none' }}>
        {sign}
        {amount}
      </span>
      {showPending && state === 'pending' && <span style={{ fontSize: 11, fontWeight: 700, color: color.sub }}>仮</span>}
    </span>
  );
}
