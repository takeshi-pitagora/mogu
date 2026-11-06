import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, stroke } from '../../theme/tokens';
import Icon from '../../components/ui/Icon';
import BottomSheet from '../../components/ui/BottomSheet';
import { pickImageFile, loadImage, cropToBlob } from '../../lib/photo';

// 確定版 Final-04：写真の選択シート（⑤）と「位置と大きさ」の切り出し画面（⑥）
//   写真ライブラリ全体へのアクセスは求めない。カメラ／ライブラリどちらも <input type="file"> の標準画面を使う
//   丸に合わせて切り出し、長い辺1024pxで保存する

function OptionsSheet({ open, hasPhoto, onPick, onRemove, onClose }) {
  const rowStyle = { height: 56, padding: '0 4px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, width: '100%' };
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="プロフィールの写真" maxHeight="none">
      <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>プロフィールの写真</p>
      <button type="button" style={{ ...rowStyle, color: color.ink }} onClick={() => onPick({ camera: true })}>
        <Icon name="camera" size={22} />
        写真を撮る
      </button>
      <button type="button" style={{ ...rowStyle, color: color.ink }} onClick={() => onPick({ camera: false })}>
        <Icon name="photoLibrary" size={22} />
        ライブラリから選ぶ
      </button>
      {hasPhoto && (
        <button type="button" style={{ ...rowStyle, borderBottom: `1px solid ${color.line}`, color: color.red }} onClick={onRemove}>
          <Icon name="trash" size={22} />
          写真を削除
        </button>
      )}
      <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose} style={{ height: 52, marginTop: 16, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
        キャンセル
      </button>
    </BottomSheet>
  );
}

function CropScreen({ img, onCancel, onDone }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);
  const WIN = 300; // 丸い窓の一辺（px。画面上の見た目）
  const AREA = 393; // プレビューが動ける領域の一辺

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onUp = () => { drag.current = null; };

  const confirm = async () => {
    setSaving(true);
    // 画面(300px窓)→保存用キャンバス(1024px)への換算
    const k = 1024 / WIN;
    const blob = await cropToBlob(img, { scale, offsetX: offset.x * k, offsetY: offset.y * k });
    setSaving(false);
    onDone(blob);
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: color.bg, display: 'flex', flexDirection: 'column', fontFamily: font.plex, color: color.ink }}>
      <div style={{ paddingTop: 'var(--safe-top)', textAlign: 'center' }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font.dela, fontSize: 18 }}>位置と大きさ</div>
      </div>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: 'relative', flex: '1 1 auto', overflow: 'hidden', touchAction: 'none', background: '#000' }}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            maxWidth: 'none',
            width: img.naturalWidth >= img.naturalHeight ? 'auto' : AREA,
            height: img.naturalWidth >= img.naturalHeight ? AREA : 'auto',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: WIN,
            height: WIN,
            borderRadius: '50%',
            border: `${stroke.shape}px solid ${color.white}`,
            boxShadow: 'rgba(0,0,0,0.55) 0 0 0 2000px',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="photoLibrary" size={18} color={color.sub} />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          style={{ flex: 1 }}
          aria-label="大きさ"
        />
      </div>
      <div style={{ padding: '0 20px 40px', display: 'flex', gap: 12 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: 56, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: radius.round, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
          やり直す
        </button>
        <button type="button" onClick={confirm} disabled={saving} style={{ flex: 1, height: 56, border: 0, borderRadius: radius.round, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
          {saving ? '保存中…' : '決定'}
        </button>
      </div>
    </div>,
    document.body
  );
}

// open のときだけ描画。hasPhoto：すでに写真があるか（「写真を削除」を出すか）
// onChange(blob | null)：blob＝新しい写真（切り出し済み）、null＝削除
export default function PhotoEditSheet({ open, hasPhoto, onClose, onChange }) {
  const [picked, setPicked] = useState(null); // { img, url }

  const pick = async ({ camera }) => {
    const file = await pickImageFile({ camera });
    if (!file) return;
    try {
      const loaded = await loadImage(file);
      setPicked(loaded);
    } catch {
      onClose();
    }
  };

  if (picked) {
    return (
      <CropScreen
        img={picked.img}
        onCancel={() => {
          URL.revokeObjectURL(picked.url);
          setPicked(null);
        }}
        onDone={(blob) => {
          URL.revokeObjectURL(picked.url);
          setPicked(null);
          onChange(blob);
        }}
      />
    );
  }

  return (
    <OptionsSheet
      open={open}
      hasPhoto={hasPhoto}
      onPick={pick}
      onRemove={() => onChange(null)}
      onClose={onClose}
    />
  );
}
