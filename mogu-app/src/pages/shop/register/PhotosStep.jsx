import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { PHOTO_KINDS, PHOTO_MAX, photoKindLabel } from '../../../lib/registerForm';
import { inspectPhoto } from '../../../lib/shopPhoto';
import { pickImageFile } from '../../../lib/photo';
import BottomSheet, { SheetTitle } from '../../../components/ui/BottomSheet';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import Button from '../../../components/ui/Button';
import { GUIDE } from '../../../lib/chara';
import StepFrame from './StepFrame';

// ⑱-5〜7 必須4：写真（確定版 Final-18 の5・6・7）
//   はじめて［写真を足す］を押したときだけ、注意のシートを出す
//   1枚目が表紙（黒い「表紙」）、種類は写真の左下
//   小さすぎる写真は赤い線と印、下に赤で「この写真は小さすぎるため使えません」
export default function PhotosStep({ form, onChange, noticeShown, onNoticeShown }) {
  const [askPick, setAskPick] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);
  const photos = form.photos;
  const tooSmall = photos.some((p) => p.tooSmall);

  const add = async (camera) => {
    setAskPick(false);
    const file = await pickImageFile({ camera });
    if (!file) return;
    try {
      const p = await inspectPhoto(file);
      onChange({ photos: [...form.photos, { id: `${Date.now()}-${Math.random()}`, kind: 'food', ...p }] });
    } catch {
      /* 読めない写真は足さない */
    }
  };

  const onAddPress = () => {
    if (!noticeShown) {
      onNoticeShown();
      setAskPick(true);
    } else {
      setAskPick(true);
    }
  };

  const update = (index, patch) => {
    const next = form.photos.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange({ photos: next });
  };
  const remove = (index) => {
    const p = form.photos[index];
    if (p?.url) URL.revokeObjectURL(p.url);
    onChange({ photos: form.photos.filter((_, i) => i !== index) });
    setOpenIndex(null);
  };
  const makeCover = (index) => {
    const next = [...form.photos];
    const [p] = next.splice(index, 1);
    onChange({ photos: [p, ...next] });
    setOpenIndex(null);
  };

  return (
    <StepFrame form={form} step="photos" title="お店の写真を足そう">
      <div style={{ flex: 'none', marginTop: 18 }}>
        <ChipRow>
          {photos.map((p, i) => (
            <PhotoTile key={p.id} photo={p} cover={i === 0 && !p.tooSmall} index={i} onOpen={() => setOpenIndex(i)} />
          ))}
          {photos.length < PHOTO_MAX && <AddTile count={photos.filter((p) => !p.tooSmall).length} onClick={onAddPress} />}
        </ChipRow>

        {photos.length === 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
            1枚以上、10枚まで。料理・ドリンク・店内・外観・メニュー表
          </p>
        )}

        {tooSmall && (
          <div role="alert" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: color.red }}>
            <WarnTriangle size={16} />
            この写真は小さすぎるため使えません
          </div>
        )}

        {photos.length > 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
            写真を押すと、種類・表紙・削除。長押しで並べ替え
          </p>
        )}
      </div>

      {/* はじめて足すときの注意（⑮の確認のシートの形。右上のふちにハリー） */}
      <BottomSheet open={askPick} onClose={() => setAskPick(false)} charaCode={GUIDE.harry} ariaLabel="写真を選ぶ前に" minHeight={290}>
        <SheetTitle>写真を選ぶ前に</SheetTitle>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.65, textAlign: 'left' }}>
          自分で撮った写真だけを使ってください。ほかのお客さんの顔が写らないようにしてください。
        </p>
        <div style={{ flex: 1, minHeight: 0 }} />
        <Button variant="primary" onClick={() => add(false)} style={{ marginTop: 18 }}>
          ライブラリから選ぶ
        </Button>
        <Button variant="secondary" onClick={() => add(true)} style={{ marginTop: 10 }}>
          写真を撮る
        </Button>
        <Button variant="text" onClick={() => setAskPick(false)} style={{ marginTop: 6 }}>
          キャンセル
        </Button>
      </BottomSheet>

      {/* 写真を押したとき（⑱-7） */}
      {openIndex != null && photos[openIndex] && (
        <PhotoSheet
          photo={photos[openIndex]}
          index={openIndex}
          count={photos.length}
          isCover={openIndex === 0}
          onKind={(kind) => update(openIndex, { kind })}
          onCover={() => makeCover(openIndex)}
          onDelete={() => remove(openIndex)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </StepFrame>
  );
}

// 写真のます（111×111）
function PhotoTile({ photo, cover, index, onOpen }) {
  const bad = photo.tooSmall;
  return (
    <button
      type="button"
      aria-label={`写真${index + 1}（${photoKindLabel(photo.kind)}）`}
      onClick={onOpen}
      className="ui-btn"
      style={{
        position: 'relative',
        flex: 'none',
        width: 111,
        height: 111,
        padding: 0,
        boxSizing: 'border-box',
        border: bad ? `3px solid ${color.red}` : `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 16,
        overflow: 'hidden',
        background: color.surface,
      }}
    >
      <img src={photo.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {cover && !bad && (
        <span style={{ position: 'absolute', left: 6, top: 6, height: 22, padding: '0 8px', borderRadius: 11, background: color.ink, color: color.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', zIndex: 2 }}>
          表紙
        </span>
      )}
      <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 8px', borderRadius: 11, background: color.white, color: color.ink, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', zIndex: 2 }}>
        {photoKindLabel(photo.kind)}
      </span>
      {bad && (
        <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <WarnTriangle size={26} />
        </span>
      )}
    </button>
  );
}

// 小さすぎる写真の印（赤い三角）
function WarnTriangle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color.red} strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
      <path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17v.5" />
    </svg>
  );
}

// ［写真を足す］のます
function AddTile({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        width: 111,
        height: 111,
        boxSizing: 'border-box',
        border: `${stroke.shape}px solid ${color.ink}`,
        borderRadius: 16,
        background: color.surface,
        color: color.ink,
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700 }}>写真を足す</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: color.sub }}>
        {count}/{PHOTO_MAX}
      </span>
    </button>
  );
}

// 写真1枚のシート（種類・表紙・削除）
function PhotoSheet({ photo, index, count, isCover, onKind, onCover, onDelete, onClose }) {
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`写真 ${index + 1}/${count}`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 200,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onClose} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>
            写真 {index + 1}/{count}
          </h2>
          <button type="button" onClick={onClose} className="ui-btn" style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
            完了
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>写真の種類</div>
          <ChipRow style={{ marginTop: 8 }}>
            {PHOTO_KINDS.map((k) => (
              <ChoiceChip key={k.value} selected={photo.kind === k.value} onClick={() => onKind(k.value)}>
                {k.label}
              </ChoiceChip>
            ))}
          </ChipRow>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            {!isCover && !photo.tooSmall && (
              <button
                type="button"
                onClick={onCover}
                className="ui-btn"
                style={{ height: 44, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                表紙にする
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="ui-btn"
              style={{ height: 44, padding: '0 14px', border: 0, background: 'transparent', color: color.red, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
            >
              この写真を削除
            </button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: color.sub }}>
            並べ替えは、写真を長押しして動かします
          </p>
        </div>
      </section>
    </>
  );
}
