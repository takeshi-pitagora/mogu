import { useCallback, useEffect, useRef, useState } from 'react';
import { color, font, stroke } from '../../../theme/tokens';
import {
  SHOW_GROW,
  canEdit,
  fetchShopProfile,
  shopPhotoUrl,
  togglePhotoVote,
  toggleSaveShop,
  toggleTagVote,
} from '../../../lib/shopProfile';
import { photoKindLabel } from '../../../lib/registerForm';
import ShopNameCopy from '../../../components/ui/ShopNameCopy';
import Icon from '../../../components/ui/Icon';
import BottomSheet, { SheetTitle } from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import OverviewTab from './OverviewTab';
import { ClosureSheet, EditRequestSheet, ReportSheet } from './ReportSheets';
import { fetchCheckingFields } from '../../../lib/shopReport';
import { BudgetDetail, CommentsTab, InfoTab, MenuTab, PhotosTab, PlusButton } from './Tabs';
import MyBudgetSheet from './MyBudgetSheet';
import HarryCorner from './HarryCorner';
import VisitSheet from '../visit/VisitSheet';
import AddSheet from '../add/AddSheet';
import TagPickSheet from '../register/TagPickSheet';
import { attachShopTags } from '../../../lib/shops';

// =============================================================
// ㉑ お店のプロフィール（確定版 Final-21）
//   タブ型。写真 → ジャンル・最寄駅 → 店名（Dela 26）＋［コピー］→「N人が保存」
//   タブはスクロールすると上に止まる
//   地図は出さない。星や点数も出さない
//   5-1 では㉒（足す・来店スタンプ）の入口を出さない
// =============================================================

const TABS = [
  { key: 'overview', label: '概要' },
  { key: 'photos', label: '写真' },
  { key: 'menu', label: 'メニュー' },
  { key: 'info', label: '情報' },
  { key: 'comments', label: 'ひとこと' },
];

export default function ShopProfile({ shopId, onBack, onOpenTag, onSendToGroup, onReport, onEdit, onShare, onNeedAccount }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('overview');
  const [menu, setMenu] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [myBudgetOpen, setMyBudgetOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [reload, setReload] = useState(0);
  const [checking, setChecking] = useState([]); // いま運営が確かめている項目（㉓-10・11）
  const [sheet, setSheet] = useState(null); // { kind: 'edit'|'closure'|'report', ... }
  const [visit, setVisit] = useState(false); // ㉒ ハリーのアンケート
  const [add, setAdd] = useState(null); // ㉒ ［＋ 足す］
  const [tagPick, setTagPick] = useState(false); // ㉒ ［＋ 足す］→ ハッシュタグ（⑲のシート）
  const scroller = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchShopProfile(shopId)
      .then((d) => {
        if (alive) {
          setData(d);
          setFailed(false);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [shopId, reload]);

  useEffect(() => {
    let alive = true;
    fetchCheckingFields(shopId).then((f) => {
      if (alive) setChecking(f);
    });
    return () => {
      alive = false;
    };
  }, [shopId, reload]);

  // タブを変えたら上に戻す
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  const patch = useCallback((fn) => setData((d) => (d ? fn(d) : d)), []);

  const onSave = async () => {
    const before = data.shop.is_saved;
    patch((d) => ({ ...d, shop: { ...d.shop, is_saved: !before, saved_count: d.shop.saved_count + (before ? -1 : 1) } }));
    try {
      await toggleSaveShop(shopId);
      toast?.show(before ? '保存をやめました' : '保存しました');
    } catch {
      patch((d) => ({ ...d, shop: { ...d.shop, is_saved: before, saved_count: d.shop.saved_count + (before ? 1 : -1) } }));
      toast?.show('いま保存できませんでした');
    }
  };

  const retry = () => {
    setData(null);
    setFailed(false);
    setReload((n) => n + 1);
  };

  const onPlusPhoto = async (photo) => {
    const before = photo.voted;
    patch((d) => ({
      ...d,
      photos: d.photos.map((p) => (p.id === photo.id ? { ...p, voted: !before, plus_count: p.plus_count + (before ? -1 : 1) } : p)),
    }));
    try {
      const n = await togglePhotoVote(photo.id);
      patch((d) => ({ ...d, photos: d.photos.map((p) => (p.id === photo.id ? { ...p, plus_count: n } : p)) }));
    } catch {
      patch((d) => ({
        ...d,
        photos: d.photos.map((p) => (p.id === photo.id ? { ...p, voted: before, plus_count: p.plus_count + (before ? 1 : -1) } : p)),
      }));
    }
  };

  const onPlusTag = async (tag) => {
    const before = tag.voted;
    patch((d) => ({
      ...d,
      tags: d.tags.map((t) => (t.id === tag.id ? { ...t, voted: !before, count: t.count + (before ? -1 : 1) } : t)),
    }));
    try {
      const n = await toggleTagVote(shopId, tag.id);
      patch((d) => ({ ...d, tags: d.tags.map((t) => (t.id === tag.id ? { ...t, count: n } : t)) }));
    } catch {
      patch((d) => ({
        ...d,
        tags: d.tags.map((t) => (t.id === tag.id ? { ...t, voted: before, count: t.count + (before ? 1 : -1) } : t)),
      }));
    }
  };

  if (failed) return <ErrorState kind="offline" onRetry={retry} />;
  if (!data) return <LoadingState />;
  if (data.closed_hidden) {
    return (
      <EmptyState
        title={'このお店は\n閉店しました'}
        description="保存していた人だけが見られます。"
        actions={[{ label: '戻る', onClick: onBack }]}
      />
    );
  }

  const { shop } = data;
  const photos = data.photos || [];
  const closed = shop.status === 'closed';
  const pending = shop.status === 'pending';
  const editable = canEdit(shop);
  const counts = { photos: photos.length, menu: (data.menu || []).length, comments: data.comment_count || 0 };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: color.white }}>
      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* 写真（300・横に送って点で何枚目か） */}
        <PhotoHeader
          photos={photos}
          closed={closed}
          closedLabel={closed ? '閉店しました' : null}
          onPlusPhoto={onPlusPhoto}
        />

        <div style={{ padding: '16px 20px 14px', borderTop: `${stroke.shape}px solid ${color.ink}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: color.sub }}>
            {[shop.genre_main, shop.station_name ? `${shop.station_name}駅 徒歩${shop.walk_min}分` : null].filter(Boolean).join('・')}
          </div>
          <div style={{ marginTop: 6 }}>
            <ShopNameCopy name={shop.name} size={26} light={false} withTabBar />
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <Icon name="savedFill" size={18} color={color.accent} />
              <span style={{ fontFamily: font.dela, fontSize: 16 }}>{shop.saved_count}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>人が保存</span>
            </span>
            {pending && <Badge>確認中</Badge>}
            {shop.is_mine && <Badge>あなたが見つけたお店</Badge>}
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => onEdit?.(shop)}
              className="ui-btn"
              style={{ marginTop: 10, height: 40, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 20, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              直す（登録から24時間）
            </button>
          )}
        </div>

        {/* タブ（スクロールすると上に止まる） */}
        <div role="tablist" style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', gap: 18, padding: '0 20px', borderBottom: `${stroke.shape}px solid ${color.ink}`, background: color.white, overflowX: 'auto' }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            const n = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className="ui-btn"
                style={{
                  flex: 'none',
                  height: 48,
                  padding: '0 2px',
                  boxSizing: 'border-box',
                  border: 0,
                  borderBottom: `3px solid ${on ? color.ink : 'transparent'}`,
                  background: 'transparent',
                  color: on ? color.ink : color.sub,
                  fontFamily: 'inherit',
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {t.label}
                {n > 0 && <span style={{ fontSize: 11 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <OverviewTab data={data} onTab={setTab} onOpenTag={onOpenTag} onPlusTag={onPlusTag} onBudgetDetail={() => setBudgetOpen(true)}
            onReportTag={(t) => setSheet({ kind: 'report', reportKind: 'tag', targetId: t.id, targetLabel: `#${t.name}` })} />
        )}
        {tab === 'photos' && (
          <PhotosTab
            data={data}
            onOpenPhoto={setViewer}
            onPlusPhoto={onPlusPhoto}
            onReportPhoto={(p) => setSheet({ kind: 'report', reportKind: 'photo', targetId: p.id, targetLabel: p.user_name ? `${p.user_name} さんの写真` : null })}
          />
        )}
        {tab === 'menu' && <MenuTab data={data} />}
        {tab === 'info' && (
          <InfoTab
            data={data}
            canWrite={SHOW_GROW}
            onWrite={() => setAdd({ start: 'field' })}
            onBudgetDetail={() => setBudgetOpen(true)}
            checking={checking}
            onRequestEdit={(key) => setSheet({ kind: 'edit', field: key })}
          />
        )}
        {tab === 'comments' && (
          <CommentsTab
            data={data}
            onReportComment={(c) => setSheet({ kind: 'report', reportKind: 'comment', targetId: c.id, targetLabel: c.user_name ? `${c.user_name} さんのひとこと` : null })}
          />
        )}
      </div>

      {/* 下に固定の［保存］［グループに送る］（⑨の確定のまま） */}
      <div style={{ flex: 'none', boxSizing: 'border-box', display: 'flex', gap: 10, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: `${stroke.shape}px solid ${color.ink}`, background: color.white }}>
        <button
          type="button"
          aria-pressed={shop.is_saved}
          onClick={onSave}
          className="ui-btn"
          style={{ flex: '1 1 0', height: 56, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name={shop.is_saved ? 'savedFill' : 'saved'} size={22} color={shop.is_saved ? color.accent : color.ink} />
          {shop.is_saved ? '保存済み' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => onSendToGroup?.(shop)}
          className="ui-btn"
          style={{ flex: '1.35 1 0', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="send" size={22} color={color.white} />
          グループに送る
        </button>
      </div>

      {/* 右上の3つ（…・共有・閉じる）。写真の上に重ねる */}
      <div style={{ position: 'absolute', right: 12, top: 'calc(12px + env(safe-area-inset-top))', display: 'flex', gap: 8, zIndex: 8 }}>
        <RoundButton label="その他（修正の依頼・閉店の報告・通報）" icon="moreFill" onClick={() => setMenu(true)} />
        <RoundButton label="共有" icon="share" onClick={() => onShare?.(shop)} />
        <RoundButton label="閉じる" icon="close" onClick={onBack} />
      </div>

      {budgetOpen && (
        <BudgetDetail
          data={data}
          onClose={() => setBudgetOpen(false)}
          onEnter={async () => {
            if (await onNeedAccount?.()) return;
            setBudgetOpen(false);
            setMyBudgetOpen(true);
          }}
        />
      )}
      {/* ⑱-24・25 自分の予算感を入れる（2人目から。性別ははじめの1回だけ聞く） */}
      {myBudgetOpen && (
        <MyBudgetSheet
          shopId={shop.id}
          mine={data.my_budget || {}}
          onClose={() => setMyBudgetOpen(false)}
          onDone={(res) => {
            if (res) {
              setData((d) => ({
                ...d,
                budget: res.budget || d.budget,
                my_budget: { ...(d.my_budget || {}), [res.time_of_day]: res.bucket },
              }));
            }
            setBudgetOpen(true);
          }}
        />
      )}
      {/* ㉒-1〜3 右下のハリーと左下の［＋ 足す］。どのタブ・どこまでスクロールしてもそこにいる */}
      {SHOW_GROW && !viewer && !sheet && !menu && !visit && !add && (
        <HarryCorner
          onAsk={async () => { if (!(await onNeedAccount?.())) setVisit(true); }}
          onAdd={async () => { if (!(await onNeedAccount?.())) setAdd({}); }}
        />
      )}

      {visit && (
        <VisitSheet
          shop={shop}
          onClose={() => setVisit(false)}
          onAskEdit={(key) => { setVisit(false); setSheet({ kind: 'edit', field: key }); }}
          onDone={(r) => {
            setVisit(false);
            setReload((n) => n + 1);
            toast?.show('来店スタンプを押しました', { withTabBar: false });
            if (r?.addPhoto) setAdd({ start: 'photo' });
          }}
        />
      )}

      {add && (
        <AddSheet
          shop={shop}
          start={add.start}
          onClose={() => setAdd(null)}
          onOpenTags={() => setTagPick(true)}
          onAdded={(what) => {
            setReload((n) => n + 1);
            toast?.show(what === 'photo' ? '写真を足しました' : what === 'menu' ? 'メニューを足しました' : '情報を足しました', { withTabBar: false });
          }}
        />
      )}

      {tagPick && (
        <TagPickSheet
          picked={[]}
          onCancel={() => setTagPick(false)}
          onDone={async (tags) => {
            setTagPick(false);
            if (tags.length > 0) {
              try {
                await attachShopTags(shop.id, tags.map((t) => t.id));
                setReload((n) => n + 1);
                toast?.show('ハッシュタグを付けました', { withTabBar: false });
              } catch {
                toast?.show('いまは付けられませんでした', { withTabBar: false });
              }
            }
          }}
        />
      )}

      {viewer && (
        <PhotoViewer
          photos={photos}
          startId={viewer.id}
          onPlus={onPlusPhoto}
          onClose={() => setViewer(null)}
        />
      )}

      {sheet?.kind === 'edit' && (
        <EditRequestSheet
          shop={shop}
          data={data}
          checking={checking}
          startField={sheet.field || null}
          onClose={() => setSheet(null)}
          onDone={() => setReload((n) => n + 1)}
        />
      )}
      {sheet?.kind === 'closure' && (
        <ClosureSheet shop={shop} onClose={() => setSheet(null)} onDone={() => setReload((n) => n + 1)} />
      )}
      {sheet?.kind === 'report' && (
        <ReportSheet
          kind={sheet.reportKind}
          shop={shop}
          target={sheet.targetId}
          targetLabel={sheet.targetLabel}
          onClose={() => setSheet(null)}
          onBlock={sheet.blockUserId ? () => { setSheet(null); onReport?.('block', sheet.blockUserId); } : null}
        />
      )}

      <BottomSheet open={menu} onClose={() => setMenu(false)} ariaLabel="このお店について" minHeight={300}>
        <SheetTitle>このお店について</SheetTitle>
        <div style={{ marginTop: 6 }}>
          <MenuRow
            icon="pencil"
            title="情報の修正を依頼する"
            sub="まちがっている・古くなった情報を知らせる"
            onClick={() => { setMenu(false); setSheet({ kind: 'edit' }); }}
          />
          <MenuRow
            icon="home"
            title="閉店・移転を報告する"
            sub="閉店・移転・休業していることを知らせる"
            onClick={() => { setMenu(false); setSheet({ kind: 'closure' }); }}
          />
          <MenuRow
            icon="flag"
            title="このお店を通報する"
            sub="存在しないお店・宣伝など"
            danger
            onClick={() => { setMenu(false); setSheet({ kind: 'report', reportKind: 'shop' }); }}
          />
        </div>
        <Button variant="text" onClick={() => setMenu(false)} style={{ marginTop: 6 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}

// ㉓-2 「このお店について」の行（しるし・見出し・小さな説明・右の〉）
function MenuRow({ icon, title, sub, danger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-btn"
      style={{
        width: '100%',
        minHeight: 72,
        padding: '12px 2px',
        border: 0,
        borderBottom: `1px solid ${color.line}`,
        background: 'transparent',
        color: color.ink,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={24} color={danger ? color.red : color.ink} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: danger ? color.red : color.ink }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 500, color: color.sub }}>{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} color={color.sub} />
    </button>
  );
}

function RoundButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="ui-btn"
      style={{ width: 44, height: 44, boxSizing: 'border-box', padding: 0, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

function Badge({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 12, background: color.surface, color: color.sub, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// 写真の帯（300。横に送って点で何枚目か。撮った人と＋1）
function PhotoHeader({ photos, closed, closedLabel, onPlusPhoto }) {
  const [index, setIndex] = useState(0);
  const track = useRef(null);
  const now = photos[index];

  const onScroll = (e) => {
    const w = e.currentTarget.clientWidth || 1;
    const i = Math.round(e.currentTarget.scrollLeft / w);
    if (i !== index) setIndex(Math.max(0, Math.min(photos.length - 1, i)));
  };

  return (
    <div style={{ position: 'relative', height: 300, background: color.surface, filter: closed ? 'grayscale(0.9) brightness(0.9)' : undefined }}>
      <div
        ref={track}
        onScroll={onScroll}
        style={{ position: 'absolute', inset: 0, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {photos.map((p) => (
          <span key={p.id} style={{ position: 'relative', flex: 'none', width: '100%', height: '100%', scrollSnapAlign: 'start' }}>
            <img src={shopPhotoUrl(p.path)} alt={photoKindLabel(p.kind)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </span>
        ))}
      </div>

      {closedLabel && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', padding: '10px 20px', background: color.ink, color: color.white, fontFamily: font.dela, fontSize: 16, textAlign: 'center', zIndex: 2 }}>
          {closedLabel}
        </div>
      )}

      {now?.user_name && (
        <div style={{ position: 'absolute', left: 14, bottom: 48, display: 'flex', alignItems: 'center', gap: 6, zIndex: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', boxSizing: 'border-box', borderRadius: 13, background: 'rgba(46,44,42,0.55)', color: color.white, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {now.user_name}の写真
          </span>
        </div>
      )}

      {now && (
        <div style={{ position: 'absolute', right: 8, bottom: 40, zIndex: 2 }}>
          <PlusButton count={now.plus_count} on={now.voted} light onClick={() => onPlusPhoto(now)} label="この写真に＋1" />
        </div>
      )}

      {photos.length > 1 && (
        <div aria-label={`写真 ${index + 1}枚目／${photos.length}枚`} style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
          {photos.map((p, i) => (
            <span key={p.id} style={{ display: 'block', width: i === index ? 18 : 7, height: 7, borderRadius: 4, background: i === index ? color.white : 'rgba(255,255,255,0.5)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ㉑-6 写真だけの画面
function PhotoViewer({ photos, startId, onPlus, onClose }) {
  const [id, setId] = useState(startId);
  const now = photos.find((p) => p.id === id) || photos[0];
  const i = photos.indexOf(now);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: color.ink, zIndex: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: 'env(safe-area-inset-top) 8px 0' }}>
        <button type="button" aria-label="閉じる" onClick={onClose} className="ui-btn" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={22} color={color.white} />
        </button>
        <span style={{ color: color.white, fontSize: 13, fontWeight: 700 }}>
          {i + 1}/{photos.length}
        </span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={shopPhotoUrl(now.path)} alt={photoKindLabel(now.kind)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
        <span style={{ flex: 1, minWidth: 0, color: color.white, fontSize: 12, fontWeight: 700 }}>
          {photoKindLabel(now.kind)}{'　'}{now.user_name ? `${now.user_name}の写真` : ''}
        </span>
        <PlusButton count={now.plus_count} on={now.voted} light onClick={() => onPlus(now)} label="この写真に＋1" />
      </div>

      {photos.length > 1 && (
        <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '0 16px calc(12px + env(safe-area-inset-bottom))', overflowX: 'auto' }}>
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={photoKindLabel(p.kind)}
              onClick={() => setId(p.id)}
              className="ui-btn"
              style={{ flex: 'none', width: 48, height: 48, padding: 0, border: p.id === now.id ? `2px solid ${color.white}` : 0, borderRadius: 10, overflow: 'hidden', background: 'transparent' }}
            >
              <img src={shopPhotoUrl(p.card_path || p.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
