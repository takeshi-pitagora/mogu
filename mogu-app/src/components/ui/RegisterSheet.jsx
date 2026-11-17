import { useEffect } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import Icon from './Icon';

// 登録のシート（確定版 Final-17・Final-18・引き渡し書 第5回 §4）
//   上から 60・角丸 32。見出し「お店を登録する」はまん中（Dela 18）、右上に×
//   2つ目の画面から左上に戻る。店名は上に小さく出し、［直す］で⑰に戻る
//   ⑰と⑱は同じこのシートの中で進む
export default function RegisterSheet({
  title = 'お店を登録する',
  shopName = null, // ⑱で上に小さく出す店名
  onEditName = null, // ［直す］（⑰に戻る）
  onBack = null, // 2つ目の画面から左上に出す
  onClose,
  children,
  footer = null,
}) {
  // 開いているあいだは後ろを動かさない
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 9 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>

        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -10px' }}>
          {onBack ? (
            <button
              type="button"
              aria-label="戻る"
              onClick={onBack}
              className="ui-btn"
              style={{ flex: 'none', width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="back" size={24} />
            </button>
          ) : (
            <span style={{ width: 44 }} />
          )}
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{title}</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="ui-btn"
            style={{ flex: 'none', width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        {/* ⑱：どのお店を登録しているか、上に小さく */}
        {shopName && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shopName}</span>
            {onEditName && (
              <button
                type="button"
                onClick={onEditName}
                className="ui-btn"
                style={{ flex: 'none', height: 32, padding: '0 12px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 16, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
              >
                直す
              </button>
            )}
          </div>
        )}

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px' }}>{children}</div>

        {footer && <div style={{ flex: 'none', paddingTop: 12 }}>{footer}</div>}
      </section>
    </>
  );
}
