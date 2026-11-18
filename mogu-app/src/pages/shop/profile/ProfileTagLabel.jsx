import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import useLongPress from '../../../lib/useLongPress';
import { LongPressMenu } from './Tabs';
import { tagFontSize } from '../../../lib/tags';
import { PROFILE_TAG_SIZE } from '../../../lib/shopProfile';

// ㉑・⑲ のタグのラベル（確定版 Final-19）
//   みんなのタグ：白に2ptの線。＋1の数を線で区切って右に。自分が＋1したらアクセント色
//   知っておきたいこと：「!」の印つきの白いラベル
//   お店の情報：角の四角いクリーム
export default function ProfileTagLabel({ tag, onOpen, onPlus, onReport }) {
  if (tag.kind === 'field') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 44,
          padding: '0 14px',
          borderRadius: 10,
          border: `${stroke.shape}px solid ${color.surface}`,
          background: color.surface,
          color: color.ink,
          fontSize: 14,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        #{tag.name}
      </span>
    );
  }

  if (tag.kind === 'notice') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 44,
          padding: '0 14px',
          borderRadius: 22,
          border: `${stroke.shape}px solid ${color.ink}`,
          background: color.white,
          color: color.ink,
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2.6" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
          <path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17v.5" />
        </svg>
        #{tag.name}
      </span>
    );
  }

  return <PublicTag tag={tag} onOpen={onOpen} onPlus={onPlus} onReport={onReport} />;
}

// みんなのタグ（長押しで［通報する］。㉓-20）
function PublicTag({ tag, onOpen, onPlus, onReport }) {
  const [menu, setMenu] = useState(false);
  const lp = useLongPress(onReport ? () => setMenu(true) : null);
  const size = tagFontSize(tag.count, PROFILE_TAG_SIZE);
  const mine = !!tag.voted;
  const ink = mine ? color.accent : color.ink;
  return (
    <>
    <span
      {...lp.handlers}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: 44,
        borderRadius: 22,
        border: `${stroke.shape}px solid ${ink}`,
        background: color.white,
        color: ink,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (lp.swallowClick()) return;
          onOpen?.(tag);
        }}
        className="ui-btn"
        style={{ padding: '0 14px', border: 0, background: 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: size, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}
      >
        #{tag.name}
      </button>
      <span aria-hidden="true" style={{ width: 2, margin: '9px 0', background: ink, opacity: 0.5 }} />
      <button
        type="button"
        aria-label={`#${tag.name} に＋1`}
        aria-pressed={mine}
        onClick={() => onPlus?.(tag)}
        className="ui-btn"
        style={{ padding: '0 12px', border: 0, background: 'transparent', color: 'inherit', fontFamily: font.dela, fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
      >
        {tag.count}
      </button>
    </span>
    {menu && (
      <LongPressMenu
        label={`#${tag.name}`}
        actions={[{ label: '通報する', danger: true, onClick: () => { setMenu(false); onReport(tag); } }]}
        onClose={() => setMenu(false)}
      />
    )}
    </>
  );
}
