import { color, font, layout } from '../../theme/tokens';
import { BackHeader } from '../../components/ui/ScreenHeader';

// =============================================================
// ⑤ 駅のデータについて（引き渡し書 §8-3「駅のデータの出典が、⑤のどこかに出ている」）
//   mogu の駅のデータは、ほかの地図サービスから取ったものではありません
// =============================================================

const BLOCKS = [
  {
    h: 'どこのデータか',
    p: 'mogu の駅の一覧（駅名・よみ・区・おおよその場所）は、mogu が自分で用意したものです。地図サービスや、ほかの会社のデータベースから取ってきたものではありません。',
  },
  {
    h: '何に使っているか',
    p: 'お店を登録するときの「最寄り駅」をえらぶところと、保存したお店を駅でしぼるところ、「近くの駅も含める」の判定に使っています。',
  },
  {
    h: 'どのくらい正しいか',
    p: '駅の場所には 300m ほどのずれがあります。「近くの駅（歩いて15分ほど・およそ1.2km）」を出すためのものなので、道案内には使えません。お店までの道順は、店名や住所をコピーして、お使いの地図アプリに貼ってお使いください。',
  },
  {
    h: 'いまある範囲',
    p: 'いまは山手線の全駅と、東京23区の主な駅、吉祥寺・中野・下北沢・自由が丘など都内の人気のエリアが入っています。まだ入っていない駅もあります。これから広げていきます。',
  },
  {
    h: 'まちがいを見つけたら',
    p: '駅名や場所のまちがいに気づいたら、設定の「ご意見・お問い合わせ」から教えてください。',
  },
];

export default function StationDataScreen({ onBack }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="駅のデータについて" onBack={onBack} />
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `4px ${layout.screenX}px ${layout.scrollBottom}px` }}>
        {BLOCKS.map((b) => (
          <section key={b.h} style={{ marginTop: 22 }}>
            <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 17, fontWeight: 400 }}>{b.h}</h2>
            <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.75 }}>{b.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
