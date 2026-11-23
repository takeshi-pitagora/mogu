import { useEffect, useMemo, useState } from 'react';
import { color, font, layout, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { TitleHeader } from '../../components/ui/ScreenHeader';
import BottomSheet from '../../components/ui/BottomSheet';
import SheetBar from '../../components/ui/SheetBar';
import Icon from '../../components/ui/Icon';
import { Radio, RadioDisabled } from '../../components/ui/Radio';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { chara, GUIDE } from '../../lib/chara';
import { fetchMyGroups, fetchSaved, sendToGroup, setSavedHidden, fetchPopularityOrder, applyPopularityOrder } from '../../lib/api';
import { externalLinks, genreLabel } from '../../lib/shop';
import { searchTags, stationsNear } from '../../lib/shops';
import { openExternal } from '../../lib/open';
import { FEATURES } from '../../lib/features';
import SavedCard, { SavedCardBody, SAVED_CARD_H } from './SavedCard';
import SavedFilterStrip from './SavedFilterStrip';
import StationFilterSheet from './StationFilterSheet';
import SendToGroupSheet from '../shop/SendToGroupSheet';

// 保存（確定版 Final-09 大きなカード型）
//   上部「保存」と並べ替え、検索「キーワードを検索」、「36件 ・ 新しい順」、大きなカードの1列
//   保存に出すのは、ひとりでいいねしたお店だけ
//   1回目の並べ替えは「新しい順・保存が多い順・予算の安い順」（評価は第5回でやめた。引き渡し書 §3）。
//   年代別の評価順は Coming Soon（押せない）。
//   「同じモグタイプに人気順」「急上昇中」は3回目まで出さない
const SORTS = [
  { key: 'new', label: '新しい順' },
  { key: 'saved', label: '保存が多い順' },
  { key: 'budget', label: '予算の安い順' },
  { key: 'mogu_type_popular', label: '同じモグタイプに人気' },
  { key: 'trending', label: '急上昇中' },
];

// ㉕ お店に付いているタグの名前だけを取り出す（タグは文字列のことも、{ name } のこともある）
const tagsOf = (s) => (s.tags || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean);
// ㉕ 絞り込みに使う駅：お店のプロフィールの最寄り駅
const stationNameOf = (s) => s.station_name || null;

function sortShops(list, key) {
  const arr = [...list];
  if (key === 'saved') arr.sort((a, b) => (Number(b.saved_count) || 0) - (Number(a.saved_count) || 0) || (b._order ?? 0) - (a._order ?? 0));
  else if (key === 'budget') arr.sort((a, b) => (a.price_level == null ? 99 : Number(a.price_level)) - (b.price_level == null ? 99 : Number(b.price_level)));
  else if (key !== 'mogu_type_popular' && key !== 'trending') arr.sort((a, b) => (b._order ?? 0) - (a._order ?? 0));
  return arr;
}

function SortSheet({ open, value, onApply, onClose, diagnosed }) {
  const [draft, setDraft] = useState(value);
  if (!open) return null;
  const row = { width: '100%', height: 60, padding: 0, border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' };
  return (
    <BottomSheet open onClose={onClose} ariaLabel="並べ替え">
      <SheetBar title="並べ替え" onCancel={onClose} actionLabel="適用" onAction={() => onApply(draft)} />
      <div role="radiogroup" aria-label="並べ替え">
        {SORTS.map((s) => {
          const disabled = s.key === 'mogu_type_popular' && !diagnosed;
          if (disabled) {
            return (
              <button key={s.key} type="button" role="radio" aria-checked="false" aria-disabled="true" disabled style={{ ...row, color: color.sub, fontWeight: 500 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {s.label}
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.surface, color: color.sub, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>診断すると選べます</span>
                </span>
                <RadioDisabled />
              </button>
            );
          }
          return (
            <button key={s.key} type="button" role="radio" aria-checked={draft === s.key} onClick={() => setDraft(s.key)} style={{ ...row, fontWeight: draft === s.key ? 700 : 500 }}>
              {s.label}
              <Radio on={draft === s.key} />
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" disabled style={{ ...row, borderBottom: 0, color: color.sub, fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            年代別の評価順
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', boxSizing: 'border-box', borderRadius: 11, background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>Coming Soon</span>
          </span>
          <RadioDisabled />
        </button>
      </div>
    </BottomSheet>
  );
}

// 長押しのシート（確定版 Final-09 の 3）：［グループに送る］［予約する］／［保存から外す］（赤）／［キャンセル］
function CardMenu({ shop, rect, onClose, onSend, onRemove, showSend }) {
  const links = externalLinks(shop);
  const lifted = rect ? (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: SAVED_CARD_H, borderRadius: 32, transform: 'scale(1.03)', boxShadow: `0 0 0 4px ${color.white}`, zIndex: 1, pointerEvents: 'none' }}
    >
      <SavedCardBody shop={shop} />
    </div>
  ) : null;
  return (
    <BottomSheet open onClose={onClose} padding="10px 20px 30px" ariaLabel={`${shop.name}のメニュー`} lifted={lifted}>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {showSend && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onSend} style={{ flex: '1 1 0px', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="send" size={20} color={color.white} />
            グループに送る
          </button>
        )}
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={() => {
            openExternal(links.hotpepper);
            onClose();
          }}
          style={{ flex: '1 1 0px', height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Icon name="calendar" size={20} />
          予約する
          <Icon name="external" size={14} color={color.sub} label="外のページを開きます" />
        </button>
      </div>
      <div style={{ height: 1, marginTop: 16, background: color.line }} />
      <button type="button" className="ui-btn" onClick={onRemove} style={{ width: '100%', height: 52, marginTop: 16, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.red}`, borderRadius: 26, background: color.white, color: color.red, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
        保存から外す
      </button>
      <button type="button" className="ui-btn ui-btn--text" onClick={onClose} style={{ width: '100%', height: 44, marginTop: 6, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
        キャンセル
      </button>
    </BottomSheet>
  );
}

// 0件（確定版 Final-09 の 8）：ハリー（150×229）、「ホームでいいねしたお店が、ここに並びます」、［お店を探す］
function SavedEmpty({ onGoHome }) {
  const h = chara(GUIDE.harry);
  return (
    <div style={{ position: 'absolute', left: 32, right: 32, top: 'calc(var(--safe-top) + 114px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2 }}>
      <img src={h?.framed} alt="" style={{ display: 'block', width: 150, height: 229, objectFit: 'contain', objectPosition: 'center bottom' }} />
      <p style={{ margin: '24px 0 0', fontFamily: font.dela, fontSize: 20, lineHeight: 1.5 }}>
        ホームでいいねしたお店が、
        <br />
        ここに並びます
      </p>
      <div style={{ width: 240, marginTop: 24 }}>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onGoHome} style={{ width: '100%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
          お店を探す
        </button>
      </div>
    </div>
  );
}

// ㉕-15 絞り込んで0件：「このタグの保存したお店はありません」＋［ホームで #○○ のお店を探す］
function SavedNoHit({ tag, onGoHome }) {
  return (
    <div style={{ padding: `12px ${layout.screenX}px 0`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <span style={{ width: 84, height: 84, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="hash" size={38} />
      </span>
      <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 19, fontWeight: 400, lineHeight: 1.45 }}>
        {tag ? (
          <>
            このタグの保存したお店は
            <br />
            ありません
          </>
        ) : (
          <>
            この絞り込みの保存したお店は
            <br />
            ありません
          </>
        )}
      </h2>
      {tag && (
        <div style={{ width: '100%', maxWidth: 300, marginTop: 22 }}>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => onGoHome?.(tag)} style={{ width: '100%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
            ホームで #{tag} のお店を探す
          </button>
        </div>
      )}
    </div>
  );
}

// ㉕-14 検索欄に # を打ったとき：⑲と同じ候補を、保存したお店の数つきで出す
function TagSuggest({ q, saved, others, onPick, onGoHome }) {
  const mark = (name) => {
    const i = q ? name.indexOf(q) : -1;
    if (i < 0) return <>#{name}</>;
    return (
      <>
        #{name.slice(0, i)}
        <span style={{ textDecoration: 'underline', textUnderlineOffset: 4, textDecorationThickness: 2 }}>{name.slice(i, i + q.length)}</span>
        {name.slice(i + q.length)}
      </>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: color.white, zIndex: 5, padding: `6px ${layout.screenX}px 0`, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {saved.length > 0 && (
        <>
          <p style={{ margin: 0, padding: '6px 4px', fontSize: 12, fontWeight: 700, color: color.sub }}>保存したお店のタグ</p>
          {saved.map((t) => (
            <button key={t.name} type="button" className="ui-btn" onClick={() => onPick(t.name)} style={{ width: '100%', minHeight: 56, padding: '0 4px', border: 0, borderBottom: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700 }}>{mark(t.name)}</span>
              <span style={{ flex: 'none', fontSize: 13, color: color.sub }}>保存 {t.n}件</span>
            </button>
          ))}
        </>
      )}
      {others.length > 0 && (
        <>
          <p style={{ margin: 0, padding: '14px 4px 6px', fontSize: 12, fontWeight: 700, color: color.sub }}>保存したお店にはないタグ</p>
          {others.map((t) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 52, borderBottom: `1px solid ${color.line}`, padding: '0 4px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: color.sub }}>#{t.name}</span>
              <button type="button" className="ui-btn ui-btn--text" onClick={() => onGoHome?.(t.name)} style={{ flex: 'none', height: 44, padding: '0 2px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
                ホームで探す
              </button>
            </div>
          ))}
        </>
      )}
      {saved.length === 0 && others.length === 0 && (
        <p style={{ margin: '20px 4px 0', fontSize: 14, fontWeight: 500, color: color.sub }}>そのタグは見つかりませんでした</p>
      )}
    </div>
  );
}

// ゲストのとき：下に1行「登録すると、保存したお店をグループに送れます」［登録する］（確定版 Final-14 の 5）
function GuestSavedLine({ onRegister }) {
  return (
    <div style={{ position: 'fixed', left: 20, right: 20, bottom: 108, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, background: color.white, zIndex: 30, maxWidth: 440, margin: '0 auto' }}>
      <Icon name="send" size={20} />
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>登録すると、保存したお店をグループに送れます</span>
      <button type="button" className="ui-btn ui-btn--primary" onClick={onRegister} style={{ flex: 'none', height: 44, padding: '0 14px', border: 0, borderRadius: 22, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
        登録する
      </button>
    </div>
  );
}

export default function SavedScreen({ version = 0, onOpenShop, onGoHome, onRegister, onGuestLocked }) {
  const { user } = useAuth();
  const toast = useToast();
  const guest = !!user?.isGuest;
  const [shops, setShops] = useState(null); // null = 読み込み中
  const [status, setStatus] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  // ㉕ 駅とハッシュタグの絞り込み
  const [pickedTags, setPickedTags] = useState([]);
  const [station, setStation] = useState(null);
  const [nearby, setNearby] = useState(false);
  const [nearNames, setNearNames] = useState([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false); // ㉕-14 ＃の候補を出しているあいだ
  const [sort, setSort] = useState('new');
  const [sheet, setSheet] = useState(null); // 'sort' | { menu: shop, rect } | { send: shop }
  const [groups, setGroups] = useState([]);
  const [popularityIds, setPopularityIds] = useState([]);
  const diagnosed = !!user?.moguType?.code;

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    fetchSaved(user.id)
      .then((list) => {
        if (!alive) return;
        // 新しい順：保存した日時があれば使い、なければ届いた順の逆（あとで足したものが新しい）
        const withOrder = list.map((s, i) => ({ ...s, _order: s.saved_at ? new Date(s.saved_at).getTime() : i }));
        setShops(withOrder);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('保存の取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [user?.id, version, reloadKey]);

  useEffect(() => {
    if (!user?.id || guest || !FEATURES.sendToGroup) return undefined;
    let alive = true;
    fetchMyGroups(user.id)
      .then((g) => alive && setGroups(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.id, guest]);

  useEffect(() => {
    if (sort !== 'mogu_type_popular' && sort !== 'trending') return undefined;
    let alive = true;
    fetchPopularityOrder(sort, user)
      .then((ids) => alive && setPopularityIds(ids))
      .catch(() => alive && setPopularityIds([]));
    return () => {
      alive = false;
    };
  }, [sort, user]);

  // ㉕-14 検索欄に # を打ったときは、キーワードではなくタグとして扱う
  const trimmed = query.trim();
  const isTagQuery = trimmed.startsWith('#') || trimmed.startsWith('＃');
  const tagQ = isTagQuery ? trimmed.slice(1).trim() : '';

  // 駅より前の絞り込み（キーワード・タグ・あなたが見つけた）。駅のシートの［○件を見る］もこれを使う
  const base = useMemo(() => {
    const q = isTagQuery ? '' : trimmed.toLowerCase();
    return (shops || []).filter((s) => {
      if (q && !([s.name, s.area, genreLabel(s), s.address].filter(Boolean).some((t) => String(t).toLowerCase().includes(q)))) return false;
      if (isTagQuery && tagQ && !tagsOf(s).includes(tagQ)) return false;
      if (mineOnly && !s.found_by_me) return false;
      if (pickedTags.length > 0) {
        const has = tagsOf(s);
        if (!pickedTags.every((t) => has.includes(t))) return false;
      }
      return true;
    });
  }, [shops, trimmed, isTagQuery, tagQ, mineOnly, pickedTags]);

  const stationNames = useMemo(() => (station ? [station, ...(nearby ? nearNames : [])] : null), [station, nearby, nearNames]);

  const filtered = useMemo(() => (stationNames ? base.filter((s) => stationNames.includes(stationNameOf(s))) : base), [base, stationNames]);

  const visible = useMemo(() => {
    if (sort === 'mogu_type_popular' || sort === 'trending') return applyPopularityOrder(filtered, popularityIds);
    return sortShops(filtered, sort);
  }, [filtered, sort, popularityIds]);

  // 段に出すタグ：保存したお店に付いているタグだけ。数は残ったお店の中の数で、0になったタグは消える
  const stripTags = useMemo(() => {
    const count = new Map();
    filtered.forEach((s) => tagsOf(s).forEach((n) => count.set(n, (count.get(n) || 0) + 1)));
    pickedTags.forEach((n) => { if (!count.has(n)) count.set(n, 0); });
    return [...count.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [filtered, pickedTags]);

  // ㉕-14 候補に出す「保存したお店のタグ」：数は保存したお店ぜんぶの中の数
  const savedTagCounts = useMemo(() => {
    const count = new Map();
    (shops || []).forEach((s) => tagsOf(s).forEach((n) => count.set(n, (count.get(n) || 0) + 1)));
    return [...count.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [shops]);

  // 駅のシートに出す駅：保存したお店の駅（多い順・数つき）
  const stripStations = useMemo(() => {
    const count = new Map();
    (shops || []).forEach((s) => {
      const n = stationNameOf(s);
      if (n) count.set(n, (count.get(n) || 0) + 1);
    });
    return [...count.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [shops]);

  const mineCount = useMemo(() => filtered.filter((s) => s.found_by_me).length, [filtered]);
  const anyFilter = pickedTags.length > 0 || !!station || mineOnly || trimmed !== '';
  // ＃の候補を出しているあいだは、段も件数の行も隠す（確定版 14）
  const suggesting = suggestOpen && isTagQuery;
  // 保存が3件以下のときと、1件も残らなかったときは、駅とタグの段を出さない（確定版 17・15）
  const showStrip = (shops || []).length > 3 && visible.length > 0 && !suggesting;

  // 候補（保存したお店にはないタグ）は⑲と同じ探し方。打つたびに探す
  const [otherTags, setOtherTags] = useState([]);
  useEffect(() => {
    if (!suggestOpen || !isTagQuery) return undefined;
    let alive = true;
    searchTags(tagQ, 20)
      .then((rows) => {
        if (!alive) return;
        const saved = new Set(savedTagCounts.map((t) => t.name));
        setOtherTags((rows || []).map((r) => ({ name: r.name })).filter((r) => r.name && !saved.has(r.name)).slice(0, 6));
      })
      .catch(() => alive && setOtherTags([]));
    return () => {
      alive = false;
    };
  }, [suggestOpen, isTagQuery, tagQ, savedTagCounts]);

  const savedCandidates = useMemo(
    () => (tagQ ? savedTagCounts.filter((t) => t.name.includes(tagQ)) : savedTagCounts).slice(0, 8),
    [savedTagCounts, tagQ],
  );

  const clearAll = () => {
    setQuery('');
    setPickedTags([]);
    setStation(null);
    setNearby(false);
    setNearNames([]);
    setMineOnly(false);
  };

  const toggleTag = (name) => setPickedTags((list) => (list.includes(name) ? list.filter((t) => t !== name) : [...list, name]));

  // 駅のシートの［○件を見る］：いまのほかの絞り込みのまま、その駅（と近くの駅）で何件になるか
  const countForStation = (pick, names) => (pick ? base.filter((s) => [pick, ...names].includes(stationNameOf(s))).length : base.length);

  // 近くの駅（1.2km以内）のうち、保存したお店がある駅だけ
  const nearOf = async (name) => {
    const rows = await stationsNear(name, 1200);
    const have = new Set(stripStations.map((s) => s.name));
    return (rows || []).map((r) => (typeof r === 'string' ? r : r.name)).filter((n) => n && n !== name && have.has(n));
  };

  const sortLabel = SORTS.find((s) => s.key === sort)?.label || '';
  // 押しても何も起きないボタンは置かない：ゲストは登録の案内、グループがなければ［グループに送る］を出さない
  const canSend = FEATURES.sendToGroup && (guest || groups.length > 0);

  const remove = async (shop) => {
    setSheet(null);
    setShops((list) => (list || []).filter((s) => s.id !== shop.id));
    try {
      await setSavedHidden({ userId: user.id, restaurantId: shop.id, hidden: true });
    } catch (err) {
      console.error('保存から外すエラー:', err?.message || err);
      setShops((list) => [...(list || []), shop]);
      return;
    }
    toast?.show('保存から外しました', {
      undo: async () => {
        setShops((list) => [...(list || []).filter((s) => s.id !== shop.id), shop]);
        try {
          await setSavedHidden({ userId: user.id, restaurantId: shop.id, hidden: false });
        } catch (err) {
          console.error('元に戻すエラー:', err?.message || err);
        }
      },
    });
  };

  const openSend = (shop) => {
    if (guest) {
      setSheet(null);
      onGuestLocked?.();
      return;
    }
    setSheet({ send: shop });
  };

  const empty = status === 'ready' && (shops || []).length === 0;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <TitleHeader title="保存" actions={[{ icon: 'sort', label: '並べ替え', onClick: () => setSheet('sort') }]} />

      {empty ? (
        <SavedEmpty onGoHome={onGoHome} />
      ) : (
        <>
          <div role="search" style={{ flex: 'none', margin: `12px ${layout.screenX}px 0`, height: 56, boxSizing: 'border-box', padding: '0 16px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 18, background: color.white, display: 'flex', alignItems: 'center', gap: 10, zIndex: 6 }}>
            <Icon name="search" size={22} color={color.sub} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                  setSuggestOpen(false);
                }
              }}
              placeholder="キーワードを検索"
              aria-label="キーワードを検索"
              enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, padding: 0 }}
            />
          </div>

          {status === 'ready' && showStrip && (
            <SavedFilterStrip
              station={station}
              nearby={nearby}
              mine={{ on: mineOnly, n: mineCount }}
              tags={stripTags}
              selectedTags={pickedTags}
              onOpenStation={() => setSheet('station')}
              onClearStation={() => { setStation(null); setNearby(false); setNearNames([]); }}
              onToggleMine={() => setMineOnly((v) => !v)}
              onToggleTag={toggleTag}
            />
          )}

          <div style={{ flex: 'none', margin: `8px ${layout.screenX}px 0`, minHeight: 20, display: suggesting ? 'none' : 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status === 'ready' && (
                <>
                  <b style={{ color: color.ink }}>{anyFilter ? `${(shops || []).length}件中 ${visible.length}件` : `${visible.length}件`}</b>
                  {' ・ '}
                  {sortLabel}
                </>
              )}
            </span>
            {status === 'ready' && anyFilter && (
              <button type="button" className="ui-btn ui-btn--text" onClick={clearAll} style={{ flex: 'none', height: 44, padding: '0 2px 0 12px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                解除
              </button>
            )}
          </div>

          <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, marginTop: 8, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {status === 'loading' && <LoadingState />}
            {status === 'error' && <ErrorState kind="server" onRetry={() => { setStatus('loading'); setReloadKey((k) => k + 1); }} style={{ height: '70%' }} />}
            {status === 'ready' && visible.length === 0 && <SavedNoHit tag={pickedTags[0] || (isTagQuery ? tagQ : '') || ''} onGoHome={onGoHome} />}
            {status === 'ready' && visible.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: `0 ${layout.screenX}px ${layout.scrollBottom + (guest && FEATURES.sendToGroup ? 72 : 0)}px` }}>
                {visible.map((s) => (
                  <SavedCard
                    key={s.id}
                    shop={s}
                    highlight={isTagQuery && tagQ ? [...pickedTags, tagQ] : pickedTags}
                    onOpen={() => onOpenShop?.(s, { from: 'saved' })}
                    onLongPress={(rect) => setSheet({ menu: s, rect })}
                  />
                ))}
              </div>
            )}
            {suggesting && (
              <TagSuggest
                q={tagQ}
                saved={savedCandidates}
                others={otherTags}
                onPick={(name) => {
                  setQuery('');
                  setSuggestOpen(false);
                  if (!pickedTags.includes(name)) toggleTag(name);
                }}
                onGoHome={(name) => {
                  setSuggestOpen(false);
                  onGoHome?.(name);
                }}
              />
            )}
          </div>
        </>
      )}

      {sheet === 'station' && (
        <StationFilterSheet
          open
          stations={stripStations}
          value={station}
          nearby={nearby}
          near0={nearNames}
          countFor={countForStation}
          getNear={nearOf}
          onClose={() => setSheet(null)}
          onClear={() => {
            setStation(null);
            setNearby(false);
            setNearNames([]);
            setSheet(null);
          }}
          onApply={(name, near, names) => {
            setStation(name);
            setNearby(near);
            setNearNames(names || []);
            setSheet(null);
          }}
        />
      )}

      {guest && FEATURES.sendToGroup && !empty && status === 'ready' && <GuestSavedLine onRegister={onRegister} />}

      {sheet === 'sort' && (
        <SortSheet
          open
          value={sort}
          diagnosed={diagnosed}
          onClose={() => setSheet(null)}
          onApply={(v) => {
            setSort(v);
            setSheet(null);
          }}
        />
      )}
      {sheet?.menu && (
        <CardMenu shop={sheet.menu} rect={sheet.rect} showSend={canSend} onClose={() => setSheet(null)} onSend={() => openSend(sheet.menu)} onRemove={() => remove(sheet.menu)} />
      )}
      {sheet?.send && (
        <SendToGroupSheet
          open
          shop={sheet.send}
          groups={groups}
          onClose={() => setSheet(null)}
          onSend={async (g) => {
            try {
              await sendToGroup({ userId: user.id, restaurant: sheet.send, groupId: g.id });
              setSheet(null);
              toast?.show(`${sheet.send.name}を、${g.name}に送りました`);
            } catch (err) {
              console.error('グループに送るエラー:', err?.message || err);
            }
          }}
        />
      )}
    </div>
  );
}
