import { useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import { photoUrlOf } from '../../../lib/profile';
import {
  foundMonth,
  highlightLabel,
  shopPhotoUrl,
  shortDate,
  splitTags,
  topBudget,
} from '../../../lib/shopProfile';
import { LINK_KEYS, PHONE_KEY } from '../../../lib/shopFields';
import Avatar from '../../../components/ui/Avatar';
import Icon from '../../../components/ui/Icon';
import DigBadge from '../../../components/ui/DigBadge';
import ProfileTagLabel from './ProfileTagLabel';

// ㉑-2 ［概要］タブ（確定版 Final-21）
//   見つけた人 → みんなのイチ押し → ハッシュタグ → 予算感
//   → おすすめメニューの上位2つ → いちばん新しいひとこと → 予約・公式のページ
export default function OverviewTab({ data, onTab, onOpenTag, onPlusTag, onBudgetDetail }) {
  const { discoverer, highlights, highlight_people: people, tags, budget, menu, comments } = data;
  const t = splitTags(tags || []);
  const [allTags, setAllTags] = useState(false); // 「ほか○つを見る」
  const fields = new Map((data.fields || []).map((f) => [f.key, f.value]));

  return (
    <div style={{ padding: '0 20px 150px' }}>
      {discoverer && (
        <>
          <H3>見つけた人</H3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <Avatar size={48} photoUrl={photoUrlOf(discoverer.avatar_path)} name={discoverer.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{discoverer.name}</span>
                <span style={{ fontSize: 12, color: color.sub }}>@{discoverer.handle}</span>
                <DigBadge value={discoverer.dig} overlay={false} />
              </div>
              <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: color.sub }}>{foundMonth(discoverer.found_at)}</div>
            </div>
          </div>
          {discoverer.reason && (
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7 }}>「{discoverer.reason}」</p>
          )}
        </>
      )}

      {highlights?.length > 0 && (
        <>
          <H3 top={26}>みんなのイチ押し</H3>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
              {highlights.slice(0, 3).map((h, i) => (
                <span key={h.key} style={{ width: `${h.percent}%`, height: 14, background: [color.ink, color.accent, color.lineStrong][i] }} />
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
              {highlights.slice(0, 3).map((h, i) => (
                <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ flex: 'none', width: 10, height: 10, borderRadius: 3, background: [color.ink, color.accent, color.lineStrong][i] }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{highlightLabel(h.key)}</span>
                  <span style={{ fontFamily: font.dela, fontSize: i === 0 ? 20 : 15 }}>{h.percent}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: color.sub }}>行った {people}人が選びました</div>
          </div>
        </>
      )}

      {(t.top.length > 0 || t.notice.length > 0 || t.field.length > 0) && (
        <>
          <H3 top={26}>ハッシュタグ</H3>
          {t.top.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {(allTags ? [...t.top, ...t.rest] : t.top).map((tag) => (
                <ProfileTagLabel key={tag.id} tag={tag} onOpen={onOpenTag} onPlus={onPlusTag} />
              ))}
            </div>
          )}
          {t.rest.length > 0 && !allTags && (
            <button
              type="button"
              onClick={() => setAllTags(true)}
              className="ui-btn"
              style={{ marginTop: 8, height: 40, padding: '0 2px', border: 0, background: 'transparent', color: color.sub, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              ほか{t.rest.length}つを見る
            </button>
          )}
          {t.notice.length > 0 && (
            <>
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: color.sub }}>知っておきたいこと</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {t.notice.map((tag) => (
                  <ProfileTagLabel key={tag.id} tag={tag} />
                ))}
              </div>
            </>
          )}
          {t.field.length > 0 && (
            <>
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: color.sub }}>お店の情報のタグ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {t.field.map((tag) => (
                  <ProfileTagLabel key={tag.id} tag={tag} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {budget?.length > 0 && (
        <>
          <H3 top={26}>予算感（ひとり）</H3>
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
            <button
              type="button"
              onClick={onBudgetDetail}
              className="ui-btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: 0, border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textAlign: 'left' }}
            >
              <span>くわしく見る（金額ごとの人数）</span>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </>
      )}

      {menu?.length > 0 && (
        <>
          <H3 top={26}>おすすめメニュー</H3>
          <div style={{ marginTop: 4 }}>
            {menu.slice(0, 2).map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <span style={{ position: 'relative', display: 'block', flex: 'none', width: 64, height: 64, borderRadius: 14, overflow: 'hidden', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, background: color.surface }}>
                  {shopPhotoUrl(m.photo_path) && (
                    <img src={shopPhotoUrl(m.photo_path)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  {m.price != null && <div style={{ marginTop: 2, fontFamily: font.dela, fontSize: 14 }}>¥{Number(m.price).toLocaleString('ja-JP')}</div>}
                  {m.user_name && <div style={{ marginTop: 2, fontSize: 11, color: color.sub }}>{m.user_name}が足しました</div>}
                </div>
              </div>
            ))}
          </div>
          {menu.length > 2 && <MoreLink onClick={() => onTab('menu')}>メニューをすべて見る（{menu.length}）</MoreLink>}
        </>
      )}

      {comments?.length > 0 && (
        <>
          <H3 top={26}>いちばん新しいひとこと</H3>
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 10, padding: '12px 0' }}>
              <Avatar size={32} photoUrl={photoUrlOf(comments[0].user_avatar)} name={comments[0].user_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{comments[0].user_name}</span>
                  <span style={{ fontSize: 11, color: color.sub }}>{shortDate(comments[0].created_at)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.6 }}>{comments[0].body}</p>
              </div>
            </div>
          </div>
          <MoreLink onClick={() => onTab('comments')}>ひとことをすべて見る（{data.comment_count}）</MoreLink>
        </>
      )}

      {(fields.get('reserve_url') || LINK_KEYS.some((k) => fields.get(k)) || fields.get(PHONE_KEY)) && (
        <>
          <H3 top={26}>予約・公式のページ</H3>
          <div style={{ marginTop: 10 }}>
            {fields.get('reserve_url') && (
              <a
                href={fields.get('reserve_url')}
                target="_blank"
                rel="noreferrer noopener"
                style={{ width: '100%', height: 56, boxSizing: 'border-box', border: 0, borderRadius: 28, background: color.ink, color: color.white, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
              >
                予約のページを開く
                <Icon name="external" size={16} color={color.white} />
              </a>
            )}
            <div style={{ marginTop: 6 }}>
              {LINK_KEYS.map((k) => fields.get(k)).filter(Boolean).map((url, i, all) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, borderBottom: i < all.length - 1 ? `1px solid ${color.line}` : 0, color: color.ink, textDecoration: 'none', fontSize: 15, fontWeight: 700 }}
                >
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkName(url)}</span>
                  <Icon name="external" size={18} color={color.sub} />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function linkName(url) {
  const u = String(url);
  if (/instagram\.com/i.test(u)) return '公式の Instagram';
  if (/x\.com|twitter\.com/i.test(u)) return '公式の X';
  if (/tabelog|hotpepper|gnavi|ebica|toreta/i.test(u)) return '予約サイト';
  return '公式サイト';
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

export function H3({ children, top = 18 }) {
  return (
    <div style={{ marginTop: top, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontFamily: font.dela, fontSize: 17, fontWeight: 400 }}>{children}</h3>
    </div>
  );
}

export function MoreLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 44, marginTop: 8, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
    >
      {children}
      <Icon name="chevronRight" size={16} />
    </button>
  );
}
