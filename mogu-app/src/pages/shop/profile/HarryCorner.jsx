import { useState } from 'react';
import { color, stroke } from '../../../theme/tokens';
import { GUIDE, chara } from '../../../lib/chara';
import Icon from '../../../components/ui/Icon';

// =============================================================
// ㉒-1〜3 お店のページの右下のハリーと、左下の［＋ 足す］
//   どのタブ・どこまでスクロールしてもそこにいる。
//   右上の×（見た目 22・押せる範囲 44）で吹き出しが消え、ハリーの丸（56）だけ残る。
//   丸を押すとまたアンケート。
// =============================================================

const HARRY = 112; // 吹き出しのとなりに立つハリーの幅

export default function HarryCorner({ bubble = true, onAsk, onAdd, onHideBubble }) {
  const [shown, setShown] = useState(bubble);
  const h = chara(GUIDE.harry);

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 96,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      {/* 左下：［＋ 足す］ */}
      <button
        type="button"
        onClick={onAdd}
        className="ui-btn"
        style={{
          pointerEvents: 'auto',
          flex: 'none',
          height: 56,
          padding: '0 22px 0 18px',
          border: 0,
          borderRadius: 28,
          background: color.ink,
          color: color.white,
          fontFamily: 'inherit',
          fontSize: 17,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon name="plus" size={20} color={color.white} strokeWidth={2.75} />
        足す
      </button>

      {/* 右下：ハリー */}
      {shown ? (
        <div style={{ pointerEvents: 'auto', flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 0, position: 'relative' }}>
          <button
            type="button"
            onClick={onAsk}
            className="ui-btn"
            style={{
              position: 'relative',
              marginRight: -10,
              padding: '12px 18px',
              border: `${stroke.shape}px solid ${color.ink}`,
              borderRadius: 24,
              background: color.white,
              color: color.ink,
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ここ行ったことある？
            </span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 14, fontWeight: 700, color: color.accent, whiteSpace: 'nowrap' }}>
              タップで回答！
            </span>
            {/* 吹き出しのしっぽ */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -9,
                bottom: 18,
                width: 16,
                height: 16,
                background: color.white,
                borderRight: `${stroke.shape}px solid ${color.ink}`,
                borderTop: `${stroke.shape}px solid ${color.ink}`,
                transform: 'rotate(45deg)',
              }}
            />
          </button>

          <button
            type="button"
            onClick={onAsk}
            className="ui-btn"
            aria-label="ここ行ったことある？ 回答する"
            style={{ flex: 'none', width: HARRY, height: HARRY * 1.1, padding: 0, border: 0, background: 'transparent' }}
          >
            <img src={h?.framed} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }} />
          </button>

          {/* 吹き出しを消す× */}
          <button
            type="button"
            aria-label="吹き出しを閉じる"
            onClick={() => {
              setShown(false);
              onHideBubble?.();
            }}
            className="ui-btn"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 44,
              height: 44,
              padding: 0,
              border: 0,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: color.ink,
                color: color.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" size={13} color={color.white} strokeWidth={2.75} />
            </span>
          </button>
        </div>
      ) : (
        // 吹き出しを消したあと：ハリーの丸（56）だけ
        <button
          type="button"
          onClick={onAsk}
          className="ui-btn"
          aria-label="ここ行ったことある？ 回答する"
          style={{
            pointerEvents: 'auto',
            flex: 'none',
            width: 56,
            height: 56,
            padding: 0,
            border: `${stroke.shape}px solid ${color.ink}`,
            borderRadius: 28,
            background: color.white,
            overflow: 'hidden',
          }}
        >
          <img
            src={h?.framed}
            alt=""
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
        </button>
      )}
    </div>
  );
}
