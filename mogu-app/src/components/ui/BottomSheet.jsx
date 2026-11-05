import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, sheet, stroke } from '../../theme/tokens';
import { chara } from '../../lib/chara';
import Button from './Button';

// §4-3 下から出るシート（確定版 Final-15・Final-04 の見本のまま）
//   角丸32（上だけ）・上のつまみ40×5・2ptの線・下の余白34・うしろに幕
//   header: { left: { label, onClick }, title, right: { label, onClick, disabled } }
//     → 左に［キャンセル］、まん中に見出し、右に黒い上の帯のボタン
//   charaCode: シートの右上のふちに立たせるキャラ（右22・幅80×高さ122・下の端はシートの上のふちから10下）
//   下に引っぱって閉じられる。変更があるシートは onRequestClose で確認を出す
export default function BottomSheet({
  open,
  onClose,
  onRequestClose,
  header,
  charaCode,
  height,
  maxHeight = '92%',
  minHeight,
  children,
  padding = sheet.padding,
  ariaLabel,
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const sheetRef = useRef(null);
  const [sheetH, setSheetH] = useState(0);

  useEffect(() => {
    if (!open || !sheetRef.current) return undefined;
    const el = sheetRef.current;
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  if (!open) return null;

  const requestClose = () => (onRequestClose ? onRequestClose() : onClose?.());

  const onDown = (e) => {
    start.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (start.current == null) return;
    setDragY(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    setDragging(false);
    if (dragY > 90) requestClose();
    setDragY(0);
  };

  const ch = charaCode ? chara(charaCode) : null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'center' }}>
      <div aria-hidden="true" className="ui-scrim-enter" onClick={requestClose} style={{ position: 'absolute', inset: 0, background: color.scrim }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', pointerEvents: 'none' }}>
        <section
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || header?.title}
          className="ui-sheet-enter"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height,
            minHeight,
            maxHeight,
            boxSizing: 'border-box',
            padding,
            border: `${stroke.shape}px solid ${color.ink}`,
            borderBottom: 0,
            borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
            background: color.bg,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${dragY}px)`,
            transition: dragging ? 'none' : 'transform 0.2s',
            pointerEvents: 'auto',
            fontFamily: font.plex,
            color: color.ink,
          }}
        >
          <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: sheet.grip.width, height: sheet.grip.height, borderRadius: 3, background: color.ink }} />
            </div>
            {header && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 0', margin: '0 -20px' }}>
                {header.left ? (
                  <Button variant="text" onClick={header.left.onClick}>{header.left.label}</Button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
                <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: font.dela, fontSize: 16, whiteSpace: 'nowrap' }}>
                  {header.title}
                </span>
                {header.right ? (
                  <Button variant="bar" onClick={header.right.onClick} disabled={header.right.disabled}>{header.right.label}</Button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
              </div>
            )}
          </div>
          {children}
        </section>
        {ch && sheetH > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', right: sheet.chara.right, bottom: sheetH - sheet.chara.overlap, transform: `translateY(${dragY}px)`, zIndex: 1 }}>
            <img src={ch.framed} alt="" style={{ display: 'block', width: sheet.chara.width, height: sheet.chara.height, objectFit: 'contain', objectPosition: 'center bottom' }} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// シートの中の見出し（確認の画面などの Dela の見出し。キャラがいるときは右に76あける）
export function SheetTitle({ children, size = 20, withChara = true }) {
  return (
    <div style={{ paddingRight: withChara ? sheet.titleRightSpace : 0 }}>
      <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: size, fontWeight: 400, lineHeight: 1.4, textAlign: 'left' }}>{children}</h2>
    </div>
  );
}
