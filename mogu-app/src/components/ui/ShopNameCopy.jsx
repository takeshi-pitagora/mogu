import { color, font } from '../../theme/tokens';
import Icon from './Icon';
import { useToast } from './Toast';

// お店の名前のコピー（確定版 Final-17 の8〜10・引き渡し書 §5 ⑰）
//   店名の右に小さな［コピー］（囲いなし・アイコン18・線2。押せる範囲は44）
//   店名そのものを押してもコピーできる
//   コピーするのは店名だけ。知らせは「お店の名前をコピーしました」（［元に戻す］なし）
export default function ShopNameCopy({ name, size = 30, light = true, withTabBar = false }) {
  const toast = useToast();

  const copy = async () => {
    const text = String(name ?? '');
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 古い WebView のとき
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast?.show('お店の名前をコピーしました', { withTabBar });
    } catch {
      // コピーできないときは何も出さない（確定版に文言がないため）
    }
  };

  const ink = light ? color.white : color.ink;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <h1
        className="no-zoom"
        onClick={copy}
        style={{
          flex: '0 1 auto',
          minWidth: 0,
          margin: 0,
          fontFamily: font.dela,
          fontSize: size,
          fontWeight: 400,
          lineHeight: 1.2,
          color: ink,
          cursor: 'pointer',
        }}
      >
        {name}
      </h1>
      <button
        type="button"
        aria-label="お店の名前をコピー"
        onClick={copy}
        className="ui-btn"
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          margin: '-4px -12px 0 -8px',
          padding: 0,
          border: 0,
          background: 'transparent',
          color: ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="copy" size={18} strokeWidth={2} color={ink} />
      </button>
    </div>
  );
}
