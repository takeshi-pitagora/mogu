import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { photoUrlOf } from '../../../lib/profile';
import { PHOTO_KINDS, photoKindLabel } from '../../../lib/registerForm';
import { FREE_TEXT_KEY, PHONE_KEY } from '../../../lib/shopFields';
import {
  INFO_ROWS,
  budgetByBucket,
  confirmedLabel,
  fieldMap,
  hasAnyHours,
  hoursRows,
  limitedLabel,
  shopPhotoUrl,
  shortDate,
  topBudget,
} from '../../../lib/shopProfile';
import Avatar from '../../../components/ui/Avatar';
import Icon from '../../../components/ui/Icon';
import ChoiceChip, { ChipRow } from '../../../components/ui/ChoiceChip';
import { H3 } from './OverviewTab';

// =============================================================
// ㉑-5〜9 ［写真］［メニュー］［情報］［ひとこと］のタブ
// =============================================================

// ---- ［写真］（㉑-5）種類で絞る・2列・撮った人と＋1 ----
export function PhotosTab({ data, onOpenPhoto, onPlusPhoto }) {
  const [kind, setKind] = useState(null);
  const photos = (data.photos || []).filter((p) => !kind || p.kind === kind);
  const kinds = PHOTO_KINDS.filter((k) => (data.photos || []).some((p) => p.kind === k.value));

  return (
    <div style={{ padding: '0 20px 150px' }}>
      {kinds.length > 1 && (
        <ChipRow style={{ marginTop: 16 }}>
          <ChoiceChip selected={kind === null} onClick={() => setKind(null)}>
            すべて
          </ChoiceChip>
          {kinds.map((k) => (
            <ChoiceChip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </ChoiceChip>
          ))}
        </ChipRow>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        {photos.map((p) => (
          <div key={p.id}>
            <button
              type="button"
              aria-label={`${photoKindLabel(p.kind)}の写真`}
              onClick={() => onOpenPhoto(p)}
              className="ui-btn"
              style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', padding: 0, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 16, overflow: 'hidden', background: color.surface }}
            >
              <img src={shopPhotoUrl(p.card_path || p.path)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 8px', borderRadius: 11, background: color.white, color: color.ink, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                {photoKindLabel(p.kind)}
              </span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Avatar size={22} photoUrl={photoUrlOf(p.user_avatar)} name={p.user_name} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user_name}</span>
              <PlusButton count={p.plus_count} on={p.voted} onClick={() => onPlusPhoto(p)} label={`${photoKindLabel(p.kind)}の写真に＋1`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlusButton({ count, on, onClick, label, light = false }) {
  const ink = on ? color.accent : light ? color.white : color.ink;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className="ui-btn"
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: light ? 30 : 26,
        padding: '0 10px',
        boxSizing: 'border-box',
        border: light ? 0 : `${stroke.shape}px solid ${ink}`,
        borderRadius: 15,
        background: light ? 'rgba(46,44,42,0.55)' : 'transparent',
        color: ink,
        fontFamily: 'inherit',
        fontSize: light ? 12 : 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      ＋1{'　'}{count}
    </button>
  );
}

export { PlusButton };

// ---- ［メニュー］（㉑-7） ----
export function MenuTab({ data }) {
  const menu = data.menu || [];
  return (
    <div style={{ padding: '0 20px 150px' }}>
      {menu.length === 0 ? (
        <Empty>まだメニューがありません</Empty>
      ) : (
        <div style={{ marginTop: 10 }}>
          {menu.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${color.line}` }}>
              <span style={{ position: 'relative', display: 'block', flex: 'none', width: 64, height: 64, borderRadius: 14, overflow: 'hidden', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, background: color.surface }}>
                {shopPhotoUrl(m.photo_path) && (
                  <img src={shopPhotoUrl(m.photo_path)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                {m.price != null && <div style={{ marginTop: 2, fontFamily: font.dela, fontSize: 14 }}>¥{Number(m.price).toLocaleString('ja-JP')}</div>}
                <div style={{ marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {m.limited_until && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: color.accent }}>{limitedLabel(m.limited_until)}</span>
                  )}
                  {m.user_name && <span style={{ fontSize: 11, color: color.sub }}>{m.user_name}が足しました</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- ［情報］（㉑-8）予算感と、項目ごとの「最後に確認」 ----
export function InfoTab({ data, canWrite, onWrite, onBudgetDetail }) {
  const map = fieldMap(data.fields);
  const budget = data.budget || [];
  const rows = INFO_ROWS.map((r) => ({ ...r, field: r.key === '__hours' ? firstHoursField(map) : map.get(r.key) }));
  const filled = rows.filter((r) => (r.key === '__hours' ? hasAnyHours(map) : !!r.field));
  const blank = rows.filter((r) => !filled.includes(r));

  return (
    <div style={{ padding: '0 20px 150px' }}>
      <H3>予算感（ひとり）</H3>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 6, fontSize: 11, fontWeight: 700, color: color.sub }}>
          <span />
          <span>男性</span>
          <span>女性</span>
        </div>
        <div style={{ marginTop: 4 }}>
          {[['dinner', '夜'], ['lunch', '昼']].map(([key, label]) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 6, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${color.line}` }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
              <BudgetCell v={topBudget(budget, key, 'male')} />
              <BudgetCell v={topBudget(budget, key, 'female')} />
            </div>
          ))}
        </div>
        {budget.length > 0 && (
          <button
            type="button"
            onClick={onBudgetDetail}
            className="ui-btn"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: 0, border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textAlign: 'left' }}
          >
            <span>くわしく見る（金額ごとの人数）</span>
            <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>

      {filled.length > 0 && (
        <>
          <H3 top={26}>お店の情報</H3>
          <div style={{ marginTop: 4 }}>
            {filled.map((r, i) => (
              <InfoRow key={r.key} row={r} map={map} first={i === 0} />
            ))}
          </div>
        </>
      )}

      {/* 空いている項目（㉒ができるまでは［＋ 書く］を出さない） */}
      {blank.length > 0 && canWrite && (
        <>
          <H3 top={26}>まだ書かれていないこと</H3>
          <div style={{ marginTop: 4 }}>
            {blank.map((r) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${color.line}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: color.sub }}>{r.title}</span>
                <button
                  type="button"
                  onClick={() => onWrite(r)}
                  className="ui-btn"
                  style={{ flex: 'none', height: 40, padding: '0 14px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  書く
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 「営業時間・定休日」はどれか1つの項目の「最後に確認」を使う
function firstHoursField(map) {
  return hoursRows(map).map((h) => h.meta).find(Boolean) || null;
}

const INFO_ICON = {
  __hours: 'clock',
  reserve: 'calendar',
  payment: 'yen',
  seats: 'tray',
  seat_count: 'group',
  party: 'personAdd',
  smoking: 'info',
  facility: 'key',
  [PHONE_KEY]: 'phone',
  [FREE_TEXT_KEY]: 'book',
};

function InfoRow({ row, map, first }) {
  const raw = row.key === '__hours' ? hoursText(map) : row.field?.value;
  // いくつでも選ぶ項目は「・」でつなぐ
  const value = raw && row.key !== '__hours' && row.key !== FREE_TEXT_KEY && row.key !== PHONE_KEY
    ? String(raw).split(',').join('・')
    : raw;
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: first ? 0 : `1px solid ${color.line}` }}>
      <span style={{ flex: 'none', paddingTop: 2 }}>
        <Icon name={INFO_ICON[row.key] || 'info'} size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: color.sub }}>{row.title}</div>
        <div style={{ marginTop: 2, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {row.key === PHONE_KEY ? <a href={`tel:${value}`} style={{ color: color.ink }}>{value}</a> : value}
        </div>
        <Confirmed f={row.field} />
      </div>
    </div>
  );
}

// 曜日ごとの時間を、同じ時間のまとまりで1行にする
//   例：「火〜木 17:00〜24:00」「金 17:00〜25:00」「定休日：月」
function hoursText(map) {
  const rows = hoursRows(map);
  if (rows.every((r) => !r.value)) return null;
  const lines = [];
  let run = null;
  rows.forEach((r) => {
    const v = r.closed ? null : r.value;
    if (v && run && run.value === v) {
      run.end = r.day;
    } else {
      if (run) lines.push(run);
      run = v ? { start: r.day, end: r.day, value: v } : null;
    }
  });
  if (run) lines.push(run);
  const closedDays = rows.filter((r) => r.closed).map((r) => r.day);
  const out = lines.map((l) => (l.start === l.end ? `${l.start} ${l.value}` : `${l.start}〜${l.end} ${l.value}`));
  if (closedDays.length > 0) out.push(`定休日：${closedDays.join('・')}`);
  return out.join('\n');
}

function BudgetCell({ v }) {
  if (!v) return <span style={{ fontSize: 12, color: color.sub }}>まだです</span>;
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: font.dela, fontSize: 14, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{v.label}</span>
      <span style={{ fontSize: 11, color: color.sub }}>{v.people}人</span>
    </span>
  );
}

function Confirmed({ f }) {
  const label = confirmedLabel(f);
  if (!label) return null;
  return <div style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: color.sub }}>{label}</div>;
}

// ---- ［ひとこと］（㉑-9）140字までを新しい順に ----
export function CommentsTab({ data }) {
  const comments = data.comments || [];
  return (
    <div style={{ padding: '0 20px 150px' }}>
      {comments.length === 0 ? (
        <Empty>まだひとことがありません</Empty>
      ) : (
        <div style={{ marginTop: 6 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: `1px solid ${color.line}` }}>
              <Avatar size={32} photoUrl={photoUrlOf(c.user_avatar)} name={c.user_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.user_name}</span>
                  <span style={{ fontSize: 11, color: color.sub }}>{shortDate(c.created_at)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.6 }}>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return <p style={{ margin: '28px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: color.sub }}>{children}</p>;
}

// ---- ㉑-11 予算感のくわしく（金額ごとの人数） ----
export function BudgetDetail({ data, onClose }) {
  const [tab, setTab] = useState('dinner');
  const rows = budgetByBucket(data.budget, tab);
  const max = Math.max(1, ...rows.map((r) => r.count));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(46,44,42,0.48)', zIndex: 13 }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="予算感（金額ごとの人数）"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 240,
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
          <span style={{ width: 70 }} />
          <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>予算感</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <ChipRow>
          <ChoiceChip selected={tab === 'dinner'} onClick={() => setTab('dinner')}>夜</ChoiceChip>
          <ChoiceChip selected={tab === 'lunch'} onClick={() => setTab('lunch')}>昼</ChoiceChip>
        </ChipRow>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 12 }}>
          {rows.length === 0 ? (
            <Empty>まだ予算感がありません</Empty>
          ) : (
            rows.map((r) => (
              <div key={r.bucket} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <span style={{ flex: 'none', width: 118, fontSize: 13, fontWeight: 700 }}>{r.label}</span>
                <span style={{ flex: 1, minWidth: 0, height: 12, borderRadius: 6, background: color.line, overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${Math.round((r.count / max) * 100)}%`, height: '100%', background: color.accent }} />
                </span>
                <span style={{ flex: 'none', width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: color.sub }}>{r.count}人</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
