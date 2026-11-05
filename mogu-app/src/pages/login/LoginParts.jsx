import { color, stroke } from '../../theme/tokens';
import { passwordRules } from '../../lib/validate';
import Icon from '../../components/ui/Icon';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../lib/links';
import { openExternal } from '../../lib/open';

// ログイン・新規登録で使う小さな部品（確定版 Final-07 のまま）

// 左上の戻る（高さ44・左右に-12）
export function BackRow({ onBack }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 44, margin: '0 -12px' }}>
      <button type="button" aria-label="戻る" onClick={onBack} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={24} />
      </button>
    </div>
  );
}

// 下線の文字リンク（13・700）
export function TextLink({ children, onClick, align = 'center', style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn ui-btn--text"
      style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : 'center', width: align === 'left' ? 'auto' : '100%', height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, ...style }}
    >
      {children}
    </button>
  );
}

// 入力のまちがい（ログインの上の赤いふちの箱）
export function ErrorBanner({ children }) {
  return (
    <div role="alert" style={{ display: 'flex', gap: 10, padding: '14px 16px', border: `${stroke.shape}px solid ${color.red}`, borderRadius: 18 }}>
      <Icon name="warning" size={22} color={color.red} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

export function PasswordChecks({ password, rules, size = 'signup' }) {
  const list = rules || passwordRules(password);
  const big = size === 'settings';
  return (
    <ul aria-label="パスワードの条件" style={{ margin: `${big ? 10 : 8}px 0 0`, padding: 0, listStyle: 'none', fontSize: big ? 13 : 12, fontWeight: 700 }}>
      {list.map((r) => (
        <li key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, height: big ? 24 : 22, color: r.ok ? color.ink : color.sub }}>
          <Icon name="check" size={16} color={r.ok ? color.ink : color.lineStrong} label={r.ok ? '満たしています' : 'まだです'} />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

// 同意の文（2つともリンク）
export function Consent() {
  const a = { padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' };
  return (
    <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: 1.7, color: color.ink }}>
      登録すると、
      <button type="button" style={a} onClick={() => openExternal(TERMS_URL)}>
        利用規約
      </button>
      と
      <button type="button" style={a} onClick={() => openExternal(PRIVACY_POLICY_URL)}>
        プライバシーポリシー
      </button>
      に同意したことになります
    </p>
  );
}
