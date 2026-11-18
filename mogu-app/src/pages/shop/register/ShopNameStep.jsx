import { color, font, stroke } from '../../../theme/tokens';
import { photoUrlOf } from '../../../lib/profile';
import { SHOP_NAME_MAX, shopPhotoUrl, walkLabel } from '../../../lib/shops';
import TextField from '../../../components/ui/TextField';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Avatar from '../../../components/ui/Avatar';

// =============================================================
// ⑰ お店を登録する①：名前と「このお店ですか？」（確定版 Final-17）
//   ・地図は出さない。位置情報も使わない（許可のお願いも出さない）
//   ・2文字から、登録済みのお店（東京全体）を名前の近い順に最大3件
//   ・候補が出ているあいだは［次へ］を押せない
//   ・「どれでもない（新しく登録する）」を押すと候補が閉じ、欄の下に
//     「登録済みのお店を確かめました」。名前を変えたら、もう一度聞く
//   ・ホームの「まだプロフィールがないお店」から来ても、入力欄は空のまま
// =============================================================

// 候補の1行（高さ60・写真44・見つけた人の丸26。距離は出さない）
function CandidateRow({ shop, onSelect }) {
  const sub = walkLabel(shop.stationName, shop.walkMin);
  const cover = shopPhotoUrl(shop.coverPath);
  return (
    <button
      type="button"
      onClick={() => onSelect(shop)}
      className="ui-btn"
      style={{
        flex: 'none',
        width: '100%',
        height: 60,
        padding: 0,
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: 'transparent',
        color: color.ink,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 'none', display: 'block', width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: color.surface }}>
        {cover && <img src={cover} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shop.name}
        </span>
        {sub && <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 500, color: color.sub }}>{sub}</span>}
      </span>
      <Avatar size={26} photoUrl={photoUrlOf(shop.discovererAvatarPath)} name={shop.discovererName} label="見つけた人" />
    </button>
  );
}

export default function ShopNameStep({
  name,
  onChangeName,
  checked,
  onConfirmChecked, // 「どれでもない（新しく登録する）」
  onPickExisting, // 候補を押した（⑰-3へ）
  search, // useShopCandidates の戻り値
}) {
  const { candidates, searching, failed, asking, error } = search;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ flex: 'none', margin: 0, fontSize: 14, lineHeight: 1.7 }}>
        あなたが見つけたお店を、みんなに教えよう。最初に登録した人は、
        <strong style={{ fontWeight: 700 }}>「見つけた人」</strong>
        としてお店に名前が残ります。
      </p>

      <div style={{ flex: 'none', marginTop: 18 }}>
        <TextField
          label="お店の名前"
          value={name}
          onChange={onChangeName}
          placeholder="例：サンプル食堂 渋谷店"
          maxLength={SHOP_NAME_MAX}
          showCount
          error={error}
          hint={
            checked ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="check" size={16} />
                登録済みのお店を確かめました
              </span>
            ) : null
          }
        />
      </div>

      {asking && (
        <div style={{ flex: 'none', marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontFamily: font.dela, fontSize: 16, fontWeight: 400 }}>このお店ですか？</h3>
            <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: color.sub }}>名前の近い順</span>
          </div>
          {candidates.map((s) => (
            <CandidateRow key={s.id} shop={s} onSelect={onPickExisting} />
          ))}
          {searching && candidates.length === 0 && (
            <p role="status" style={{ margin: 0, height: 60, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: color.sub }}>
              探しています
            </p>
          )}
          <button
            type="button"
            onClick={onConfirmChecked}
            className="ui-btn"
            style={{
              flex: 'none',
              width: '100%',
              height: 52,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: color.ink,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
            }}
          >
            <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={20} />
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>どれでもない（新しく登録する）</span>
          </button>
        </div>
      )}

      {/* 登録済みのお店を読めなかったとき：確かめる手順は飛ばさない */}
      {failed && !checked && !error && (
        <div style={{ flex: 'none', marginTop: 18 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>いま登録済みのお店を見られませんでした。</p>
          <Button variant="secondary" onClick={onConfirmChecked} style={{ marginTop: 10 }}>
            確かめずに新しく登録する
          </Button>
        </div>
      )}
    </div>
  );
}

// ⑰-3 名前が同じお店がすでにあるとき（赤や注意の印は使わない）
export function AlreadyRegistered({ shop }) {
  const sub = walkLabel(shop.stationName, shop.walkMin);
  const cover = shopPhotoUrl(shop.coverPath);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ flex: 'none', margin: '8px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4 }}>
        このお店はもう登録されています
      </h3>

      <div style={{ flex: 'none', marginTop: 14, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 180, borderBottom: `${stroke.shape}px solid ${color.ink}`, background: color.surface }}>
          {cover && <img src={cover} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontFamily: font.dela, fontSize: 20, lineHeight: 1.3 }}>{shop.name}</div>
          {sub && <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: color.sub }}>{sub}</div>}
          {shop.discovererName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Avatar size={26} photoUrl={photoUrlOf(shop.discovererAvatarPath)} name={shop.discovererName} label="見つけた人" />
              <span style={{ fontSize: 12, fontWeight: 500, color: color.sub }}>見つけた人</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{shop.discovererName || '退会したユーザー'}</span>
            </div>
          )}
        </div>
      </div>

      <p style={{ flex: 'none', margin: '12px 0 0', fontSize: 14, lineHeight: 1.7 }}>
        写真やタグ、まだ空いている情報を足すことはできます。
      </p>
    </div>
  );
}
