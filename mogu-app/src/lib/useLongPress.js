import { useRef } from 'react';

// 長押し（㉓の入口。550ms 押すとメニューが出る）
//   指を動かしたり離したりしたら取り消す
export default function useLongPress(onLongPress, ms = 550) {
  const timer = useRef(null);
  const fired = useRef(false);

  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    if (!onLongPress) return;
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  };

  return {
    handlers: onLongPress
      ? {
        onPointerDown: start,
        onPointerUp: clear,
        onPointerLeave: clear,
        onPointerCancel: clear,
        onContextMenu: (e) => e.preventDefault(),
      }
      : {},
    // 長押しが出たあとの click は無視する
    swallowClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
