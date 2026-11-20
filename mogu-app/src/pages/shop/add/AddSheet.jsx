import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { shopAddRoom } from '../../../lib/visit';
import Icon from '../../../components/ui/Icon';
import MoguCoin from '../../../components/ui/MoguCoin';
import AddPhotoStep from './AddPhotoStep';
import AddFieldStep from './AddFieldStep';
import AddMenuStep from './AddMenuStep';

// =============================================================
// ㉒-13 ［＋ 足す］の一覧
//   写真（1枚＋1・1店に5枚）・空いている項目（1項目＋1・名前が残る）
//   ・おすすめメニュー（＋2・3品）・ハッシュタグ（新しいタグ＋1・5つ）
//   コインは一覧とボタンに小さく「＋2」だけ。
//   上限に達したものは、一覧で理由を短く（㉒-21）。
// =============================================================

function Row({ icon, glyph, title, sub, coin, disabled, onClick, last }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="ui-btn"
      style={{
        width: '100%',
        minHeight: 76,
        padding: '12px 2px',
        border: 0,
        borderBottom: last ? 0 : `1px solid ${color.line}`,
        background: 'transparent',
        color: disabled ? color.sub : color.ink,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 48,
          height: 48,
          borderRadius: 24,
          border: `${stroke.shape}px solid ${disabled ? color.lineStrong : color.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {glyph ? (
          <span style={{ fontFamily: font.dela, fontSize: 20, color: disabled ? color.sub : color.ink }}>{glyph}</span>
        ) : (
          <Icon name={icon} size={23} color={disabled ? color.sub : color.ink} />
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 500, color: color.sub, lineHeight: 1.5 }}>{sub}</span>
      </span>
      {!disabled && (
        <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <MoguCoin size={20} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>+{coin}</span>
        </span>
      )}
      {!disabled && <Icon name="chevronRight" size={18} color={color.sub} />}
    </button>
  );
}

export default function AddSheet({ shop, start, onClose, onAdded, onOpenTags }) {
  const [room, setRoom] = useState(null);
  const [step, setStep] = useState(start || null);

  useEffect(() => {
    let alive = true;
    shopAddRoom(shop.id)
      .then((r) => alive && setRoom(r))
      .catch(() => {});
    return () => { alive = false; };
  }, [shop.id]);

  const done = (what) => {
    shopAddRoom(shop.id).then(setRoom).catch(() => {});
    setStep(null);
    onAdded?.(what);
  };

  if (step === 'photo') return <AddPhotoStep shop={shop} room={room} onBack={() => setStep(null)} onDone={() => done('photo')} />;
  if (step === 'field') return <AddFieldStep shop={shop} room={room} onBack={() => setStep(null)} onDone={() => done('field')} />;
  if (step === 'menu') return <AddMenuStep shop={shop} onBack={() => setStep(null)} onDone={() => done('menu')} />;

  const photosLeft = Math.min(room?.photos_left ?? 0, room?.photos_day_left ?? 0);
  const openFields = room?.open_fields?.length ?? 0;
  const menuLeft = room?.menu_left ?? 0;
  const tagsLeft = room?.tags_left ?? 0;

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="このお店に足す"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onClose} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>このお店に足す</h2>
        </div>

        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
          すでにある情報は書き換えられません。間違いは「…」の［情報の修正を依頼する］から
        </p>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Row
            icon="camera"
            title="写真を足す"
            sub={photosLeft > 0 ? `1枚ごとに・あと${photosLeft}枚（1店に5枚まで）` : 'このお店に足せる写真は、もういっぱいです'}
            coin={1}
            disabled={photosLeft <= 0}
            onClick={() => setStep('photo')}
          />
          <Row
            icon="pencil"
            title="空いている項目を書く"
            sub={openFields > 0 ? `1項目ごとに。名前が残る・${openFields}項目が空いています` : '空いている項目はありません'}
            coin={1}
            disabled={openFields <= 0}
            onClick={() => setStep('field')}
          />
          <Row
            icon="book"
            title="おすすめメニューを足す"
            sub={menuLeft > 0 ? `1品ごとに・あと${menuLeft}品` : 'このお店に足せるメニューは、もういっぱいです'}
            coin={2}
            disabled={menuLeft <= 0}
            onClick={() => setStep('menu')}
          />
          <Row
            glyph="#"
            title="ハッシュタグ"
            sub={tagsLeft > 0 ? `新しいタグ（＋1は0）・あと${tagsLeft}つ` : 'このお店に付けられるタグは、もういっぱいです'}
            coin={1}
            disabled={tagsLeft <= 0}
            onClick={() => { onClose(); onOpenTags?.(); }}
            last
          />
        </div>
      </section>
    </>
  );
}
