import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { MENU_NAME_MAX } from '../../../lib/shopFields';
import { photoKindLabel } from '../../../lib/registerForm';
import TextField from '../../../components/ui/TextField';
import Icon from '../../../components/ui/Icon';

// ⑱-9・13 おすすめメニュー／期間限定メニュー（確定版 Final-18）
//   1行48pxの写真＋名前＋値段。押すと直すシートが出る
export default function MenuEditor({ items, max, addLabel, photos, onChange, dated }) {
  const [editing, setEditing] = useState(null); // index（新しく足すときは items.length）

  const commit = (index, row) => {
    const next = [...items];
    if (index >= items.length) next.push(row);
    else next[index] = row;
    onChange(next.filter((r) => String(r.name ?? '').trim() !== ''));
    setEditing(null);
  };
  const remove = (index) => {
    onChange(items.filter((_, i) => i !== index));
    setEditing(null);
  };

  return (
    <div style={{ flex: 'none' }}>
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setEditing(i)}
          className="ui-btn"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            padding: 0,
            border: 0,
            borderBottom: `1px solid ${color.line}`,
            background: 'transparent',
            color: color.ink,
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <span style={{ position: 'relative', display: 'block', flex: 'none', width: 48, height: 48, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 12, overflow: 'hidden', background: color.surface }}>
            {photoOf(photos, it.photoId)?.url && (
              <img src={photoOf(photos, it.photoId).url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>
              {[it.price !== '' && it.price != null ? `¥${Number(it.price).toLocaleString('ja-JP')}` : null, it.until ? `${dateLabel(it.until)}まで` : null]
                .filter(Boolean)
                .join('　') || '値段は未入力'}
            </span>
          </span>
          <Icon name="chevronRight" size={18} color={color.sub} />
        </button>
      ))}

      {items.length < max && (
        <button
          type="button"
          onClick={() => setEditing(items.length)}
          className="ui-btn"
          style={{
            flex: 'none',
            alignSelf: 'flex-start',
            marginTop: 10,
            height: 44,
            padding: '0 16px',
            boxSizing: 'border-box',
            border: `${stroke.shape}px solid ${color.ink}`,
            borderRadius: 22,
            background: color.white,
            color: color.ink,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {addLabel}
        </button>
      )}

      {editing != null && (
        <MenuSheet
          row={items[editing] || { name: '', price: '', until: '', photoId: null }}
          isNew={editing >= items.length}
          photos={photos}
          dated={dated}
          onDone={(row) => commit(editing, row)}
          onDelete={() => remove(editing)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function photoOf(photos, id) {
  return (photos || []).find((p) => p.id === id) || null;
}

function dateLabel(key) {
  const [, m, d] = String(key).split('-');
  return `${Number(m)}月${Number(d)}日`;
}

function MenuSheet({ row, isNew, photos, dated, onDone, onDelete, onCancel }) {
  const [name, setName] = useState(row.name || '');
  const [price, setPrice] = useState(row.price ?? '');
  const [until, setUntil] = useState(row.until || '');
  const [photoId, setPhotoId] = useState(row.photoId || null);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'メニューを足す' : 'メニューを直す'}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 220,
          bottom: 0,
          boxSizing: 'border-box',
          padding: '10px 20px 34px',
          border: `${stroke.shape}px solid ${color.ink}`,
          borderBottom: 0,
          borderRadius: '32px 32px 0 0',
          background: color.white,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: color.ink }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
          <button type="button" onClick={onCancel} className="ui-btn" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
            キャンセル
          </button>
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{dated ? '期間限定メニュー' : 'おすすめメニュー'}</h2>
          <button
            type="button"
            disabled={name.trim() === ''}
            onClick={() => onDone({ name: name.trim(), price, until, photoId })}
            className="ui-btn"
            style={{
              height: 44,
              padding: '0 18px',
              border: 0,
              borderRadius: 22,
              background: name.trim() === '' ? color.surface : color.ink,
              color: name.trim() === '' ? color.sub : color.white,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            完了
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -20px', padding: '0 20px 12px' }}>
          <TextField label="メニューの名前" value={name} onChange={setName} maxLength={MENU_NAME_MAX} showCount placeholder="例：自家製フルーツサワー" />
          <div style={{ marginTop: 12 }}>
            <TextField label="値段（任意）" value={String(price ?? '')} onChange={setPrice} type="number" inputMode="numeric" placeholder="680" prefix="¥" />
          </div>
          {dated && (
            <div style={{ marginTop: 12 }}>
              <TextField label="いつまで（任意）" value={until} onChange={setUntil} type="date" />
            </div>
          )}

          {photos?.length > 0 && (
            <>
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700 }}>写真（任意）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {photos.filter((p) => !p.tooSmall).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={photoKindLabel(p.kind)}
                    aria-pressed={photoId === p.id}
                    onClick={() => setPhotoId(photoId === p.id ? null : p.id)}
                    className="ui-btn"
                    style={{
                      position: 'relative',
                      flex: 'none',
                      width: 64,
                      height: 64,
                      padding: 0,
                      boxSizing: 'border-box',
                      border: `${photoId === p.id ? 3 : stroke.shape}px solid ${photoId === p.id ? color.accent : color.ink}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: color.surface,
                    }}
                  >
                    <img src={p.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {!isNew && (
            <button
              type="button"
              onClick={onDelete}
              className="ui-btn"
              style={{ marginTop: 18, height: 44, padding: '0 14px', border: 0, background: 'transparent', color: color.red, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
            >
              この行を消す
            </button>
          )}
        </div>
      </section>
    </>
  );
}
