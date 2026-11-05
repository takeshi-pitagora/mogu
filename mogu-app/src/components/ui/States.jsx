import { color, font } from '../../theme/tokens';
import { chara, GUIDE } from '../../lib/chara';
import Button from './Button';

// §4-6・§4-7 空の画面・読み込み中・通信できない（確定版 Final-15 の見本のまま）

const harry = () => chara(GUIDE.harry);

const centerBox = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontFamily: font.plex,
  color: color.ink,
};

// 空の画面（0件）：ハリー（幅140）→ 見出し（Dela 20）→ 説明（1行）→ 黒いボタン（高さ56・幅240）
// ボタンは1つ（グループだけ2つ）。増やすことをすすめない画面は見出しだけ
export function EmptyState({ title, description, actions = [], style }) {
  const h = harry();
  return (
    <div style={{ ...centerBox, padding: '0 28px', ...style }}>
      <img src={h?.framed} alt="" style={{ display: 'block', width: 140, height: 214, objectFit: 'contain', objectPosition: 'center bottom' }} />
      <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4, textAlign: 'center' }}>{title}</h2>
      {description && <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.65, color: color.sub, textAlign: 'center', whiteSpace: 'pre-line' }}>{description}</p>}
      {actions.length > 0 && (
        <div style={{ width: 240, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((a, i) => (
            <Button key={a.label} variant={i === 0 ? 'primary' : 'secondary'} onClick={a.onClick} icon={a.icon}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// 読み込み中（初めて）：ハリー（幅110）と3つの点（左から順に黒くなる）、「読み込んでいます」
export function LoadingState({ label = '読み込んでいます', style }) {
  const h = harry();
  return (
    <div role="status" style={{ ...centerBox, padding: '0 32px', ...style }}>
      <img src={h?.framed} alt="" style={{ display: 'block', width: 110, height: 168, objectFit: 'contain', objectPosition: 'center bottom' }} />
      <div aria-hidden="true" style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <span className="ui-dot" style={{ width: 10, height: 10, borderRadius: '50%' }} />
        <span className="ui-dot" style={{ width: 10, height: 10, borderRadius: '50%' }} />
        <span className="ui-dot" style={{ width: 10, height: 10, borderRadius: '50%' }} />
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 700 }}>{label}</p>
    </div>
  );
}

// 通信できない（前の内容がない）／相手（サーバー）の不具合：ハリー（幅140）、見出し、説明、［もう一度読み込む］
// 赤は使わない
export function ErrorState({ kind = 'offline', onRetry, style }) {
  const text =
    kind === 'server'
      ? { title: '読み込めませんでした', description: '少したってから、もう一度お試しください' }
      : { title: '通信できません', description: '電波のよい場所で、もう一度お試しください' };
  return <EmptyState title={text.title} description={text.description} actions={onRetry ? [{ label: 'もう一度読み込む', icon: 'refresh', onClick: onRetry }] : []} style={style} />;
}

// 通信できない（前の内容がある）：見出しの下にクリームの帯（高さ60）、文字だけの2行と［読み込む］
export function OfflineBand({ description = '前に読み込んだ内容を表示しています', onRetry, style }) {
  return (
    <div
      role="status"
      style={{
        height: 60,
        boxSizing: 'border-box',
        padding: '0 12px 0 20px',
        background: color.surface,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: font.plex,
        color: color.ink,
        ...style,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>通信できません</span>
        <span style={{ display: 'block', fontSize: 12, color: color.sub }}>{description}</span>
      </span>
      {onRetry && (
        <Button variant="small" onClick={onRetry}>
          読み込む
        </Button>
      )}
    </div>
  );
}

