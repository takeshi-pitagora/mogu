import { useEffect, useMemo, useState } from 'react';
import { color, font, layout, paper, stroke } from '../../theme/tokens';
import { BackHeader } from '../../components/ui/ScreenHeader';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Avatar from '../../components/ui/Avatar';
import Dig from '../../components/ui/Dig';
import { useAuth } from '../../context/AuthContext';
import { photoUrlOf } from '../../lib/profile';
import { shopPhotoUrl } from '../../lib/shops';
import { digAt } from '../../lib/dig';
import {
  actionLabel, coinRank, dayLabel, myCoinLog, myCoinMonths, myFound, myLikes, myNotebook, weekLabel,
} from '../../lib/notebook';
import NotebookCover from './NotebookCover';
import { Coin, CoinStamp, Mincho, Num, Page, PageTitle, Tape } from './NotebookParts';
import { TABS } from './tabs';
import CoinReasonSheet from './CoinReasonSheet';

// =============================================================
// ㉖ 探検手帳（確定版 Final-26）
//   コインの数を見るのはここだけ。右のしおりで
//   ［記録］［番付］［いいね］［見つけた］［もらい方］をめくる
// =============================================================

// 今月の残り日数（番付の「今月はあと◯日」）
function daysLeftInMonth() {
  const n = new Date();
  const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return Math.max(0, last - n.getDate());
}

const dot = { flex: 1, borderBottom: `1px dotted ${paper.slotLine}`, transform: 'translateY(-4px)' };

// ［記録］（㉖-2〜4）
function LogPage({ log, months, onReason, onRegister }) {
  const byDay = useMemo(() => {
    const m = new Map();
    log.forEach((r) => {
      if (!m.has(r.day)) m.set(r.day, []);
      m.get(r.day).push(r);
    });
    return [...m.entries()];
  }, [log]);
  const now = months[0];

  if (log.length === 0) {
    return (
      <>
        <PageTitle title="記録" />
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: font.mincho, fontWeight: 800, fontSize: 16, lineHeight: 1.7 }}>
            最初のお店を
            <br />
            登録してみよう
          </p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={onRegister} style={{ minHeight: 48, marginTop: 16, padding: '0 22px', border: 0, borderRadius: 24, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            お店を登録する
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="記録" note={now ? String(now.month).slice(0, 7).replace('-', '.') : null} />
      {now && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, fontSize: 12, fontWeight: 700, color: color.sub }}>
          {`${Number(String(now.month).split('-')[1])}月`}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coin size={14} />
            <Num size={15}>+{now.confirmed}</Num> 確定
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coin size={14} state="pending" />
            <Num size={15} muted>+{now.pending}</Num> 仮
          </span>
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        {byDay.map(([day, rows]) => (
          <div key={day} style={{ display: 'grid', gridTemplateColumns: '46px minmax(0, 1fr)', gap: 8, borderBottom: `1px solid ${paper.slotLine}` }}>
            <div style={{ paddingTop: 12, textAlign: 'center' }}>
              <Num size={18}>{dayLabel(day)}</Num>
              <div style={{ marginTop: 5 }}><Mincho size={11} color={color.sub}>{weekLabel(day)}</Mincho></div>
            </div>
            <div>
              {rows.map((r, i) => {
                const off = r.state === 'cancelled';
                // 押せるのは「取消」の行だけ（わけを出す）。
                // それ以外をボタンにすると、押しても何も起きないものに見えてしまう
                const Tag = off ? 'button' : 'div';
                return (
                  <Tag
                    key={r.id}
                    {...(off ? { type: 'button', className: 'ui-btn', onClick: () => onReason(r), 'aria-label': `${actionLabel(r.action, r.amount)} が取り消されたわけを見る` } : {})}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 60, padding: '8px 0', boxSizing: 'border-box', border: 0, borderBottom: i < rows.length - 1 ? `1px dashed ${paper.slotLine}` : 'none', background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{actionLabel(r.action, r.amount)}</span>
                      {r.shop_name && <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: color.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.shop_name}</span>}
                    </span>
                    <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Coin size={15} state={r.state} />
                      <Num size={18} muted={r.state !== 'confirmed'} strike={off}>{off ? '−' : '+'}{r.amount}</Num>
                      <span style={{ marginLeft: 2 }}><CoinStamp state={r.state} /></span>
                    </span>
                  </Tag>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ［番付］（㉖-5〜8）
function RankPage({ scope, onScope, rows, visible, onOpenSettings, onOpenUser }) {
  const me = rows.find((r) => r.is_me);
  const top = rows.filter((r) => !r.is_me);   // 自分はいつも下の付箋に出す
  const three = top.slice(0, 3);
  const rest = top.slice(3);
  const order = [three[1], three[0], three[2]].filter(Boolean);
  const tints = ['rgba(226,237,229,0.92)', 'rgba(240,214,196,0.92)', 'rgba(226,237,229,0.92)'];

  return (
    <>
      <PageTitle title="番付" note={scope === 'month' ? new Date().toISOString().slice(0, 7).replace('-', '.') : null} />

      <div style={{ display: 'flex', marginTop: 12, padding: 4, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: 'transparent' }}>
        {[['month', '今月'], ['all', 'ずっと']].map(([k, label]) => (
          <button key={k} type="button" className="ui-btn" onClick={() => onScope(k)} aria-pressed={scope === k} style={{ flex: 1, height: 44, border: 0, borderRadius: 22, background: scope === k ? color.ink : 'transparent', color: scope === k ? color.white : color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
            {label}
          </button>
        ))}
      </div>

      {!visible ? (
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: color.sub }}>
            「ランキングに名前を出す」がオフのため、番付には出ていません。コインはたまっています
          </p>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onOpenSettings} style={{ minHeight: 48, marginTop: 14, padding: '0 22px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 24, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            設定を変える
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 10, fontSize: 12, fontWeight: 700, color: color.sub }}>
            <span>上位100人・確定したコイン</span>
            {scope === 'month' && <span>今月はあと{daysLeftInMonth()}日</span>}
          </div>

          {/* 上位3人は写真を貼ったカード（2・1・3 の順に並べる） */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {order.map((r, i) => (
              <button key={r.user_id} type="button" className="ui-btn" onClick={() => onOpenUser?.(r)} style={{ position: 'relative', flex: '1 1 0', maxWidth: 110, padding: `${r.rank === 1 ? 16 : 10}px 8px 12px`, boxSizing: 'border-box', border: `1.5px solid ${color.ink}`, borderRadius: 4, background: color.white, color: color.ink, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Tape w={46} h={14} tint={tints[i]} tilt={i === 1 ? -4 : 6} style={{ position: 'absolute', left: i === 1 ? 'auto' : -6, right: i === 1 ? 'auto' : undefined, top: -7 }} />
                <span style={{ position: 'absolute', left: 8, top: 6, fontFamily: font.fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: r.rank === 1 ? 26 : 20, lineHeight: 1 }}>{r.rank}</span>
                <Avatar size={r.rank === 1 ? 54 : 46} photoUrl={photoUrlOf(r.avatar_path)} name={r.name} label="" />
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{r.name}</span>
                <Dig n={r.dig} size={11} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Coin size={14} />
                  <Num size={17}>{r.coins}</Num>
                </span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            {rest.map((r) => (
              <button key={r.user_id} type="button" className="ui-btn" onClick={() => onOpenUser?.(r)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '6px 0', border: 0, borderBottom: `1px dashed ${paper.slotLine}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}>
                <Num size={18} style={{ width: 28, textAlign: 'right' }}>{r.rank}</Num>
                <Avatar size={34} photoUrl={photoUrlOf(r.avatar_path)} name={r.name} label="" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <Dig n={r.dig} size={11} />
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: color.sub }}>@{r.handle}</span>
                </span>
                <span aria-hidden="true" style={dot} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Coin size={14} />
                  <Num size={17}>{r.coins}</Num>
                </span>
              </button>
            ))}
          </div>

          {/* 自分は付箋で下に（100位より下のときはそう書く） */}
          {me && (
            <div style={{ position: 'sticky', bottom: 0, marginTop: 16, padding: '10px 12px', borderRadius: 4, background: '#F7DDD6', boxShadow: '0 -2px 10px rgba(46,44,42,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tape w={60} h={16} tint="rgba(240,214,196,0.95)" tilt={-3} style={{ position: 'absolute', left: '50%', top: -8, marginLeft: -30 }} />
              {me.rank > 100 ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: color.sub, width: 64 }}>100位より下</span>
              ) : (
                <Num size={22} style={{ width: 40, textAlign: 'right' }}>{me.rank}</Num>
              )}
              <Avatar size={38} photoUrl={photoUrlOf(me.avatar_path)} name={me.name} label="" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</span>
                  <Dig n={me.dig} size={11} />
                </span>
                <span style={{ display: 'block', fontSize: 11, color: color.sub }}>@{me.handle}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Coin size={14} />
                <Num size={19}>{me.coins}</Num>
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ［いいね］（㉖-9・10）
function LikesPage({ likes, onOpenShop }) {
  if (!likes) return null;
  const parts = [
    { key: 'saved', label: 'お店が保存された', n: likes.saved, tint: '#C08268', pattern: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 8px)' },
    { key: 'photo', label: '写真への＋1', n: likes.photo, tint: '#9FC3AE', pattern: 'radial-gradient(circle at 3px 3px, rgba(255,255,255,0.55) 1.5px, transparent 1.6px)' },
    { key: 'tag', label: 'タグへの＋1', n: likes.tag, tint: '#E6BFD2', pattern: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 3px, transparent 3px 7px)' },
  ];
  const sum = Math.max(1, parts.reduce((a, b) => a + b.n, 0));

  return (
    <>
      <PageTitle title="いいね" note={null} />
      <div style={{ marginTop: -26, paddingLeft: 92, fontFamily: font.mincho, fontWeight: 800, fontSize: 13, color: color.sub }}>もらった数</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 20 }}>
        <span style={{ fontFamily: font.dela, fontSize: 46, lineHeight: 1 }}>{likes.total}</span>
        <span style={{ fontFamily: font.mincho, fontWeight: 800, fontSize: 17 }}>いいね</span>
      </div>

      {/* マスキングテープの長さで内訳 */}
      <div style={{ display: 'flex', gap: 3, marginTop: 16, height: 18 }}>
        {parts.filter((p) => p.n > 0).map((p) => (
          <span key={p.key} style={{ width: `${(p.n / sum) * 100}%`, height: '100%', backgroundColor: p.tint, backgroundImage: p.pattern, backgroundSize: p.key === 'photo' ? '7px 7px' : undefined, transform: 'rotate(-0.6deg)' }} />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {parts.map((p) => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 44, borderBottom: `1px dashed ${paper.slotLine}` }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 14, alignSelf: 'center', backgroundColor: p.tint, backgroundImage: p.pattern, backgroundSize: p.key === 'photo' ? '7px 7px' : undefined }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</span>
            <span aria-hidden="true" style={dot} />
            <Num size={18}>{p.n}</Num>
          </div>
        ))}
      </div>

      {(likes.top || []).length > 0 && (
        <>
          <h3 style={{ margin: '22px 0 0', fontFamily: font.mincho, fontWeight: 800, fontSize: 17, letterSpacing: '0.06em' }}>いいねの多い順</h3>
          <div style={{ marginTop: 8, borderTop: `${stroke.shape}px solid ${color.ink}` }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            {likes.top.map((t, i) => (
              <button key={t.id} type="button" className="ui-btn" onClick={() => onOpenShop?.(t.id)} style={{ position: 'relative', padding: '8px 8px 10px', border: 0, background: color.white, boxShadow: '0 1px 0 rgba(46,44,42,0.18)', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}>
                <Tape w={44} h={14} tint={i % 2 ? 'rgba(226,237,229,0.92)' : 'rgba(240,214,196,0.92)'} tilt={i % 2 ? 4 : -5} style={{ position: 'absolute', left: 10, top: -7 }} />
                <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '1 / 1', background: `#5E4B3C center/cover no-repeat url(${shopPhotoUrl(t.photo) || ''})` }}>
                  <span style={{ position: 'absolute', left: 6, top: 6, height: 22, padding: '0 8px', borderRadius: 11, background: color.ink, color: color.white, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>見つけたお店</span>
                </span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, color: '#C08268' }}>
                  ♥<Num size={16}>{t.n}</Num>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ［見つけた］（㉖-11・12）
function FoundPage({ found, onOpenShop }) {
  const n = { confirmed: 0, pending: 0, cancelled: 0 };
  found.forEach((f) => { n[f.state] = (n[f.state] || 0) + 1; });

  return (
    <>
      <PageTitle title="見つけた" note={`${found.length}店`} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
        {['confirmed', 'pending', 'cancelled'].map((k) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CoinStamp state={k} />
            <Num size={20} muted={k !== 'confirmed'}>{n[k] || 0}</Num>
          </span>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        {found.map((f) => (
          <button key={f.shop_id} type="button" className="ui-btn" onClick={() => onOpenShop?.(f.shop_id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 78, padding: '8px 0', border: 0, borderBottom: `1px dashed ${paper.slotLine}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', textAlign: 'left' }}>
            {/* 写真の角を留めた行 */}
            <span style={{ position: 'relative', flex: 'none', width: 62, height: 62, background: `#5E4B3C center/cover no-repeat url(${shopPhotoUrl(f.photo) || ''})` }}>
              {/* 写真の角を留める（黒い三角） */}
              {[
                { left: 0, top: 0, clip: 'polygon(0 0, 100% 0, 0 100%)' },
                { right: 0, top: 0, clip: 'polygon(100% 0, 100% 100%, 0 0)' },
                { left: 0, bottom: 0, clip: 'polygon(0 0, 0 100%, 100% 100%)' },
                { right: 0, bottom: 0, clip: 'polygon(100% 0, 100% 100%, 0 100%)' },
              ].map((c, i) => (
                <span key={i} aria-hidden="true" style={{ position: 'absolute', ...c, width: 14, height: 14, background: color.ink, clipPath: c.clip }} />
              ))}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>
                {`${Number(String(f.found_on).split('-')[1])}月${Number(String(f.found_on).split('-')[2])}日に見つけた`}
              </span>
            </span>
            <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Num size={18} muted={f.state !== 'confirmed'} strike={f.state === 'cancelled'}>{f.state === 'cancelled' ? '−' : '+'}10</Num>
              <CoinStamp state={f.state} />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// ［もらい方］（㉖-13・14）。値は引き渡し書 §6-2 と同じ
const HOW = [
  ['お店を見つけて登録する', '10'],
  ['しっかり登録（写真3枚と任意の項目5つ）', '+5'],
  ['見つけたお店が10人・50人・100人に保存された', '+5 ・ +10 ・ +20'],
  ['写真を足す／表紙に選ばれた', '1枚1／+3'],
  ['空いている項目を書く', '1項目1'],
  ['おすすめメニューを足す', '2'],
  ['新しいタグを付ける（ほかの2人が＋1したら確定）', '1'],
  ['来店スタンプ', '1'],
  ['ひとこと（10字以上）', '1'],
  ['情報の確認', '1'],
  ['修正依頼・閉店の報告が採用された', '3'],
];

function HowPage() {
  return (
    <>
      <PageTitle title="もらい方" />
      <h3 style={{ margin: '16px 0 0', fontFamily: font.mincho, fontWeight: 800, fontSize: 17, letterSpacing: '0.06em' }}>コインのもらい方</h3>
      <div style={{ marginTop: 8, borderTop: `${stroke.shape}px solid ${color.ink}` }} />
      <div>
        {HOW.map(([label, v]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 48, padding: '8px 0', borderBottom: `1px dashed ${paper.slotLine}` }}>
            <span style={{ flex: '0 1 auto', fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>{label}</span>
            <span aria-hidden="true" style={dot} />
            <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Coin size={15} />
              <Num size={17}>{v}</Num>
            </span>
          </div>
        ))}
      </div>

      {/* 仮と確定の2枚のメモ */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {[['仮', 'したらすぐ入ります。番付には入りません'], ['確定', 'ほかの人が保存・来店・確認するか、運営が確かめたとき']].map(([k, t], i) => (
          <div key={k} style={{ flex: 1, position: 'relative', padding: '14px 12px 12px', background: i ? '#F7EAD1' : color.white, boxShadow: '0 1px 0 rgba(46,44,42,0.18)', transform: `rotate(${i ? 0.8 : -0.8}deg)` }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><CoinStamp state={i ? 'confirmed' : 'pending'} /></div>
            <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.6 }}>{t}</p>
          </div>
        ))}
      </div>

      {/* dig のこと（付箋） */}
      <div style={{ marginTop: 20, padding: '14px 14px 16px', background: '#F7DDD6', transform: 'rotate(-0.5deg)' }}>
        <div style={{ fontFamily: font.mincho, fontWeight: 800, fontSize: 15 }}>dig のこと</div>
        <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.75 }}>
          dig はコインとは別で、ほかの人からもらったいいねの数で上がります。上限はありません。
          dig<strong> n </strong>に必要なもらったいいねの累計は <strong>5 × n × (n − 1)</strong>（dig2＝10、dig10＝450、dig50＝12,250）。
        </p>
      </div>

      <div style={{ marginTop: 18, padding: '12px 12px', border: `${stroke.shape}px double ${color.ink}`, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
        コインも dig も、お金や商品には換えられません
      </div>
    </>
  );
}

export default function NotebookScreen({ onBack, onOpenShop, onOpenSettings, onOpenRegister, onOpenUser, initialTab = 'log' }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState('loading');
  const [head, setHead] = useState(null);
  const [log, setLog] = useState([]);
  const [months, setMonths] = useState([]);
  const [scope, setScope] = useState('month');
  const [rank, setRank] = useState([]);
  const [likes, setLikes] = useState(null);
  const [found, setFound] = useState([]);
  const [reason, setReason] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([myNotebook(), myCoinLog(), myCoinMonths()])
      .then(([h, l, m]) => {
        if (!alive) return;
        setHead(h);
        setLog(l);
        setMonths(m);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('探検手帳の取得エラー:', err?.message || err);
        if (alive) setStatus('error');
      });
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (tab !== 'rank') return undefined;
    let alive = true;
    coinRank(scope).then((r) => alive && setRank(r)).catch(() => {});
    return () => { alive = false; };
  }, [tab, scope]);

  useEffect(() => {
    if (tab !== 'likes' || likes) return undefined;
    let alive = true;
    myLikes().then((r) => alive && setLikes(r)).catch(() => {});
    return () => { alive = false; };
  }, [tab, likes]);

  useEffect(() => {
    if (tab !== 'found' || found.length > 0) return undefined;
    let alive = true;
    myFound().then((r) => alive && setFound(r)).catch(() => {});
    return () => { alive = false; };
  }, [tab, found.length]);

  const dig = head?.dig || 1;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <BackHeader title="探検手帳" onBack={onBack} />

      {status === 'loading' && <LoadingState style={{ height: '70%' }} />}
      {status === 'error' && <ErrorState kind="server" onRetry={() => { setStatus('loading'); setReloadKey((k) => k + 1); }} style={{ height: '70%' }} />}

      {status === 'ready' && head && (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `6px 16px ${layout.scrollBottom}px` }}>
          <NotebookCover
            name={user?.name || 'あなた'}
            since={head.since}
            dig={dig}
            coins={head.coins}
            pending={head.pending}
            likes={head.likes}
            at={digAt(dig)}
            nextAt={digAt(dig + 1)}
          >
            <Page tab={tab} onTab={setTab} page={TABS.findIndex((t) => t.key === tab) + 1}>
              {tab === 'log' && <LogPage log={log} months={months} onReason={setReason} onRegister={onOpenRegister} />}
              {tab === 'rank' && <RankPage scope={scope} onScope={setScope} rows={rank} visible={head.rank_visible} onOpenSettings={onOpenSettings} onOpenUser={onOpenUser} />}
              {tab === 'likes' && <LikesPage likes={likes} onOpenShop={onOpenShop} />}
              {tab === 'found' && <FoundPage found={found} onOpenShop={onOpenShop} />}
              {tab === 'how' && <HowPage />}
            </Page>
          </NotebookCover>
        </div>
      )}

      <CoinReasonSheet row={reason} onClose={() => setReason(null)} />

    </div>
  );
}
