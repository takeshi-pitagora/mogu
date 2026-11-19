import { color, font, stroke } from '../../../theme/tokens';
import MoguCoin from '../../../components/ui/MoguCoin';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ⑳-1〜4 登録が終わったとき（確定版 Final-20）
//   「あなたが見つけたお店」の手帳に今日の1行が足される
//   コインは仮（ほかの人が保存したり、運営が確かめると確定する）
//   5-1 では⑳-5〜12（探検手帳と確定の演出）は作らない
// =============================================================

export default function RegisteredSheet({
  shopName,
  coins, // { total, pending, gained, fullRegister }
  found, // [{ no, name, when, gained, pending }] 新しい順
  firstEver, // はじめての登録
  newAccount, // 新しいアカウントの最初の3店
  onOpenShop,
  onAgain,
  onClose,
}) {
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="登録しました！"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 60,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>

        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -10px' }}>
          <span style={{ width: 44 }} />
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>登録しました！</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ flex: 'none', width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={24} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px' }}>
          {firstEver && (
            <p style={{ margin: '0 0 10px' }}>
              <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: color.surface, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                はじめてお店を見つけました
              </span>
            </p>
          )}

          {/* 見つけたお店の手帳 */}
          <div style={{ flex: 'none', marginTop: 4, padding: '6px 4px 4px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 12px 8px' }}>
              <span style={{ fontFamily: font.dela, fontSize: 15 }}>あなたが見つけたお店</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>{found.length}店</span>
            </div>
            {found.map((f, i) => (
              <div
                key={`${f.no}-${f.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 60,
                  padding: '0 12px',
                  background: i === 0 ? color.surface : 'transparent',
                  borderBottom: `1px solid ${color.line}`,
                  borderRadius: i === 0 ? 12 : 0,
                }}
              >
                <span style={{ flex: 'none', width: 26, fontFamily: font.dela, fontSize: 16, color: i === 0 ? color.ink : color.sub }}>{f.no}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: color.sub }}>{f.when}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <MoguCoin size={20} state={f.pending ? 'pending' : 'confirmed'} />
                  <span style={{ fontFamily: font.dela, fontSize: 15 }}>＋{f.gained}</span>
                  {f.pending && <span style={{ fontSize: 11, fontWeight: 700, color: color.sub }}>仮</span>}
                </span>
              </div>
            ))}
          </div>

          {/* モグコイン */}
          <div style={{ flex: 'none', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>モグコイン</span>
            <span style={{ flex: 1 }} />
            <span aria-label={`モグコイン ${coins.total}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <MoguCoin size={22} />
              <span style={{ fontFamily: font.dela, fontSize: 20, lineHeight: 1 }}>{coins.total}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: color.sub }}>
              <MoguCoin size={18} state="pending" />仮 {coins.pending}
            </span>
          </div>

          {coins.fullRegister && (
            <div style={{ flex: 'none', marginTop: 4, fontSize: 12, fontWeight: 700, color: color.sub }}>
              今回：見つけた人 ＋10・しっかり登録 ＋5
            </div>
          )}

          <p style={{ flex: 'none', margin: '10px 0 0', padding: '12px 14px', borderRadius: 16, background: color.surface, fontSize: 13, fontWeight: 500, lineHeight: 1.65 }}>
            {newAccount
              ? '運営が確かめるまで、コインは仮のままです（数日かかることがあります）'
              : 'ほかの人がこのお店を保存したり、運営が確かめたりすると、コインが確定します。'}
          </p>
          <p style={{ flex: 'none', margin: '6px 0 0', fontSize: 12, color: color.sub, lineHeight: 1.6 }}>
            登録してから24時間は、お店のページから自分で直せます
          </p>
        </div>

        <div style={{ flex: 'none', paddingTop: 12 }}>
          <Button variant="primary" onClick={() => onOpenShop(shopName)}>
            お店のページを見る
          </Button>
          <button
            type="button"
            onClick={onAgain}
            className="ui-btn"
            style={{ width: '100%', height: 52, marginTop: 10, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}
          >
            続けて登録する
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn"
            style={{ width: '100%', height: 44, marginTop: 4, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}
          >
            閉じる
          </button>
        </div>
      </section>
    </>
  );
}
