import { useEffect, useRef, useState } from 'react';
import { color, font, layout } from '../../theme/tokens';
import { BackHeader } from '../../components/ui/ScreenHeader';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { myStamp, myStamps, sheetsOf, todayIso } from '../../lib/stampBook';
import StampSheet from './StampSheet';
import StampDetailSheet from './StampDetailSheet';

// =============================================================
// ③ スタンプ帳（確定版 Final-03-StampBook の 2・3・7）
//   いちばん新しい台紙を開く。右へめくると前の台紙（下の点で何枚目か）。地は白。
//   はじめたばかりのときは、もらい方の1行と空の台紙。
// =============================================================

const SHEET_W = 329;
const GAP = 12;
const EDGE = 16; // 台紙の左右（確定版は 16。前の台紙が左に少し見える）

export default function StampBook({ onBack, onOpenShop }) {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('loading');
  const [page, setPage] = useState(0); // 0 = いちばん新しい台紙
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);

  useEffect(() => {
    let alive = true;
    myStamps()
      .then((rows) => {
        if (!alive) return;
        setList(rows);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('スタンプ帳の取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const sheets = sheetsOf(list || []);
  const last = sheets.length - 1;
  const current = last - page; // 画面に出ている台紙の番号（0 = 1枚目）
  const today = todayIso();

  const open = async (s) => {
    try {
      setDetail(await myStamp(s.id));
    } catch (err) {
      console.error('スタンプの取得エラー:', err?.message || err);
    }
  };

  const onDown = (e) => {
    drag.current = { x: e.clientX, mode: null };
  };
  const onMove = (e) => {
    const g = drag.current;
    if (!g) return;
    const d = e.clientX - g.x;
    if (!g.mode && Math.abs(d) > 8) {
      g.mode = 'h';
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (g.mode === 'h') {
      const atEdge = (page >= last && d > 0) || (page <= 0 && d < 0);
      setDx(atEdge ? d * 0.3 : d);
    }
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const d = dx;
    setDx(0);
    if (d > 50) setPage((p) => Math.min(last, p + 1)); // 右へめくる＝前の台紙
    else if (d < -50) setPage((p) => Math.max(0, p - 1));
  };

  const empty = status === 'ready' && (list || []).length === 0;
  // 画面のまん中に今の台紙が来るように、左にずらす量
  const shift = current * (SHEET_W + GAP) - EDGE;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.white, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="スタンプ帳" onBack={onBack} />

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState kind="server" onRetry={() => { setStatus('loading'); setReloadKey((k) => k + 1); }} style={{ height: '70%' }} />}

      {status === 'ready' && (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `0 0 ${layout.scrollBottom}px` }}>
          {empty ? (
            <p style={{ margin: `0 ${EDGE}px`, fontSize: 15, lineHeight: 1.7 }}>
              お店のページの右下のハリーから、行った日を答えると来店スタンプがもらえます。キャラは16体からランダムです
            </p>
          ) : (
            <p style={{ margin: `0 ${EDGE}px`, fontSize: 12, fontWeight: 700, color: color.sub }}>
              {`${String(list[0].visited_on).split('-')[0]}年${Number(String(list[0].visited_on).split('-')[1])}月から・${list.length}個`}
            </p>
          )}

          <div style={{ marginTop: 12, overflow: 'hidden' }}>
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{ display: 'flex', gap: GAP, paddingLeft: EDGE, transform: `translateX(${-shift + dx}px)`, transition: dx === 0 ? 'transform 0.24s ease-out' : 'none', touchAction: 'pan-y' }}
            >
              {sheets.map((sheet, i) => (
                <StampSheet key={i} index={i} stamps={sheet} todayIso={today} onOpen={open} width={SHEET_W} />
              ))}
            </div>
          </div>

          {sheets.length > 1 && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 5 }}>
              {sheets.map((_, i) => (
                <span key={i} style={{ width: i === current ? 18 : 7, height: 7, borderRadius: 4, background: i === current ? color.ink : color.lineStrong }} />
              ))}
            </div>
          )}
        </div>
      )}

      <StampDetailSheet
        stamp={detail}
        onClose={() => setDetail(null)}
        onOpenShop={(id) => {
          setDetail(null);
          onOpenShop?.(id);
        }}
      />
    </div>
  );
}
