import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { color, font, toast as T } from '../../theme/tokens';

// §4-5 短い知らせ（確定版 Final-15 の見本のまま）
//   文字だけの黒いカプセル（高さ60から・角丸30）。［元に戻す］は白いボタン（高さ44）
//   下のタブの上に12（画面の下から106）、左右16。下のタブがない画面では下から34
//   約4秒で消える（［元に戻す］があるときは6秒）。2行まで。新しいほうに入れ替える
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [item, setItem] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setItem(null);
  }, []);

  const show = useCallback((message, { undo, withTabBar = true } = {}) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setItem({ id, message, undo, withTabBar });
    timer.current = setTimeout(() => setItem((cur) => (cur && cur.id === id ? null : cur)), undo ? T.durationUndo : T.duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {item &&
        createPortal(
          <div
            key={item.id}
            role="status"
            className="ui-toast-enter"
            style={{
              position: 'fixed',
              left: T.side,
              right: T.side,
              bottom: item.withTabBar ? T.bottomWithTab : T.bottomNoTab,
              minHeight: T.minHeight,
              boxSizing: 'border-box',
              padding: item.undo ? '8px 8px 8px 20px' : '8px 20px',
              borderRadius: T.radius,
              background: color.ink,
              color: color.white,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 90,
              fontFamily: font.plex,
              maxWidth: 448,
              margin: '0 auto',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.message}
            </span>
            {item.undo && (
              <button
                type="button"
                className="ui-btn"
                onClick={() => {
                  item.undo();
                  hide();
                }}
                style={{ flex: 'none', height: 44, padding: '0 16px', boxSizing: 'border-box', border: 0, borderRadius: 22, background: color.white, color: color.ink, fontFamily: font.plex, fontSize: 14, fontWeight: 700 }}
              >
                元に戻す
              </button>
            )}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
