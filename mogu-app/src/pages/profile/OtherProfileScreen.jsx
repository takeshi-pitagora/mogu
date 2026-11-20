import { useEffect, useState } from 'react';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { blockUser, getProfileView, photoUrlOf, submitReport, unblockUser } from '../../lib/profile';
import { useToast } from '../../components/ui/Toast';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { Radio } from '../../components/ui/Radio';
import BottomSheet from '../../components/ui/BottomSheet';
import Dig from '../../components/ui/Dig';
import CompatCard from './CompatCard';
import { useAuth } from '../../context/AuthContext';
import { userDig, userFoundShops } from '../../lib/dig';
import { axesOf } from '../../lib/compat';
import { AXIS_LABELS, AXIS_META, axisPercent } from '../../lib/axis';
import { fetchUserTags, shopPhotoUrl } from '../../lib/shops';

// 他の人のプロフィール（確定版 f03-5・f03-6）＋「…」の通報・ブロック（f13-1〜f13-20の、相手を指定するほう）
//   同じグループのメンバーの行から開く（userId）。IDの完全一致（handle）でも開ける
const REASONS = [
  { id: 'photo', label: '不適切な写真' },
  { id: 'profile', label: '不適切な名前・自己紹介' },
  { id: 'impersonation', label: 'なりすまし' },
  { id: 'harassment', label: 'いやがらせ・しつこい招待' },
  { id: 'other', label: 'その他' },
];
const OTHER_DETAIL_MAX = 200;

// 「…」：通報する／ブロックする／キャンセル（f13-2・f13-15）
function MoreSheet({ open, onClose, name, onReport, onBlock }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`${name} さん`}>
      <p style={{ margin: '14px 0 6px', textAlign: 'center', fontSize: 13, color: color.sub }}>{name} さん</p>
      <button
        type="button"
        onClick={onReport}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderWidth: '1px 0 0', padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
      >
        <Icon name="flag" size={22} color={color.red} />
        通報する
      </button>
      <button
        type="button"
        onClick={onBlock}
        style={{ height: 56, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}`, padding: '0 4px', background: 'transparent', color: color.red, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}
      >
        <Icon name="block" size={22} color={color.red} />
        ブロックする
      </button>
      <Button variant="secondary" onClick={onClose} style={{ marginTop: 16 }}>
        キャンセル
      </Button>
    </BottomSheet>
  );
}

// 通報する：理由を選ぶ→その他は内容を書く→送信→受け付けました（f13-3・f13-4・f13-5・f13-16・f13-17）
function ReportSheet({ open, onClose, targetId, name, onBlockAfter }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const close = () => {
    setReason(null);
    setOtherText('');
    setError('');
    setSent(false);
    onClose?.();
  };

  const send = async () => {
    if (!reason || (reason === 'other' && !otherText.trim())) return;
    setBusy(true);
    setError('');
    const res = await submitReport({ kind: 'user', reason, detail: reason === 'other' ? otherText.trim() : null, targetUser: targetId });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="通報を受け付けました" minHeight={250}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
          <span style={{ display: 'flex', width: 64, height: 64, borderRadius: '50%', background: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={color.white} />
          </span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.35, textAlign: 'center' }}>通報を受け付けました</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>内容を確認して対応します</p>
        <Button
          variant="danger"
          onClick={() => {
            close();
            onBlockAfter?.();
          }}
          style={{ marginTop: 22 }}
        >
          この人をブロックする
        </Button>
        <Button variant="secondary" onClick={close} style={{ marginTop: 10 }}>
          閉じる
        </Button>
      </BottomSheet>
    );
  }

  if (reason === 'other') {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="通報する">
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: font.dela, fontSize: 18 }}>通報する</div>
          <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{name} さん</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, marginTop: 12, borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${color.line}` }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>その他</span>
          <button type="button" onClick={() => setReason(null)} style={{ height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}>
            理由を変える
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ minHeight: 96, padding: '12px 17px', border: `${stroke.focus}px solid ${color.ink}`, borderRadius: 18, background: color.white }}>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value.slice(0, OTHER_DETAIL_MAX))}
              placeholder="くわしい内容を入れてください"
              rows={3}
              style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65, color: color.ink }}
            />
          </div>
          <div style={{ marginTop: 6, textAlign: 'right', fontSize: 12, fontWeight: 700, color: color.sub }}>
            {otherText.length}/{OTHER_DETAIL_MAX}
          </div>
        </div>
        {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
        <Button variant="primary" onClick={send} disabled={busy || !otherText.trim()} style={{ marginTop: 8 }}>
          送信する
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} ariaLabel="通報する">
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: font.dela, fontSize: 18 }}>通報する</div>
        <div style={{ marginTop: 2, fontSize: 13, color: color.sub }}>{name} さん</div>
      </div>
      <p style={{ margin: '14px 0 10px', fontSize: 13, fontWeight: 700, color: color.sub }}>あてはまるものを1つ選んでください</p>
      <div role="radiogroup" aria-label="通報の理由" style={{ borderBottom: `1px solid ${color.line}` }}>
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            style={{ width: '100%', minHeight: 56, padding: '0 2px', border: 0, borderTop: `1px solid ${color.line}`, background: 'transparent', color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ flex: '1 1 0%', textAlign: 'left', fontSize: 16, fontWeight: reason === r.id ? 700 : 500 }}>{r.label}</span>
            <Radio on={reason === r.id} />
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: color.red }}>{error}</p>}
      <Button variant="primary" disabled={busy || !reason} onClick={send} style={{ marginTop: 20 }}>
        送信する
      </Button>
    </BottomSheet>
  );
}

export default function OtherProfileScreen({ userId, handle, onBack, onInvite, onShare, onDiagnose, onOpenTypeResult }) {
  const toast = useToast();
  const { user } = useAuth();
  const [dig, setDig] = useState(1);
  const [found, setFound] = useState(0);
  const [foundList, setFoundList] = useState(null); // ㉖-16 その人が見つけたお店
  const [tags, setTags] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    getProfileView({ userId, handle }).then((r) => {
      if (!alive) return;
      setData(r.data || null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, handle]);

  // ③-11 dig は見るだけ。自分のハッシュタグと同じ出し方でその人のタグも出す
  useEffect(() => {
    if (!data?.id) return undefined;
    let alive = true;
    userDig(data.id).then((d) => { if (alive) { setDig(d?.dig || 1); setFound(d?.found || 0); } }).catch(() => {});
    fetchUserTags(data.id).then((r) => alive && setTags(r || [])).catch(() => {});
    return () => { alive = false; };
  }, [data?.id]);

  const doBlock = async () => {
    setBlockConfirm(false);
    const res = await blockUser(data.id);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    setData((d) => ({ ...d, blocked: true, blocked_by_me: true }));
    toast?.show('ブロックしました', {
      undo: async () => {
        const r = await unblockUser(data.id);
        if (!r.error) setData((d) => ({ ...d, blocked: false, blocked_by_me: false }));
      },
    });
  };

  const doUnblock = async () => {
    const res = await unblockUser(data.id);
    if (res.error) {
      toast?.show(res.error);
      return;
    }
    setData((d) => ({ ...d, blocked: false, blocked_by_me: false }));
  };

  const handleShown = data?.handle || handle || '';
  const header = (
    <header style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 'calc(var(--safe-top) + 44px)', paddingTop: 'var(--safe-top)', paddingLeft: 8, paddingRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: color.bg, zIndex: 4 }}>
      <button type="button" aria-label="戻る" onClick={onBack} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={24} />
      </button>
      {/* ③-11 まん中に @ID */}
      <span style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{handleShown}</span>
      <button type="button" aria-label="その他（通報・ブロック）" onClick={() => setMore(true)} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, border: 0, padding: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="moreFill" size={24} />
      </button>
    </header>
  );

  if (loading || !data) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: color.bg, fontFamily: font.plex, color: color.ink }}>
        {header}
      </div>
    );
  }

  const name = data.display_name || data.handle || '';
  const type = getType(data.type_code);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      {header}
      <div style={{ padding: 'calc(var(--safe-top) + 44px + 14px) 20px 130px' }}>
        {data.blocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
            <Avatar size={72} blocked name={data.handle} />
            <span style={{ display: 'block', marginTop: 10, fontSize: 13, color: color.sub }}>@{data.handle}</span>
            <p style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 700 }}>ブロック中のユーザーです</p>
            <button type="button" onClick={doUnblock} style={{ marginTop: 10, height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}>
              ブロックを解除
            </button>
          </div>
        ) : (
          <>
            {/* ③-11 写真（88）の右下に dig（見るだけ）・名前・モグキャラのふだ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <Avatar size={88} photoUrl={photoUrlOf(data.avatar_path)} name={name} label="写真" />
                <span style={{ position: 'absolute', right: -14, bottom: -12, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', minWidth: 52, minHeight: 28, padding: '0 4px 2px 0' }}>
                  <Dig n={dig} size={14.6} outline />
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 8px' }}>
                <h1 className="no-zoom" style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{name}</h1>
                {type && (
                  <button
                    type="button"
                    className="ui-btn"
                    onClick={() => onOpenTypeResult?.(data)}
                    aria-label={`モグキャラ ${type.code} ${type.name}（押すと診断の結果）`}
                    style={{ flex: 'none', height: 34, padding: '0 12px 0 5px', border: 0, borderRadius: 17, background: g ? g.light : color.surface, color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {ch?.display && <img src={ch.display} alt="" style={{ display: 'block', width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                    <span style={{ fontFamily: font.dela, fontSize: 13, color: g ? g.dark : color.ink }}>{type.code}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{type.name}</span>
                  </button>
                )}
              </div>
            </div>

            {data.bio && <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, overflowWrap: 'anywhere' }}>{data.bio}</p>}

            {/* ㉖-15 見つけたお店（押すと、その人が見つけたお店） */}
            {found > 0 && (
              <button
                type="button"
                className="ui-btn"
                onClick={() => userFoundShops(data.id).then(setFoundList).catch(() => setFoundList([]))}
                style={{ width: '100%', minHeight: 56, marginTop: 14, padding: '0 14px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 18, background: color.white, color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
              >
                <Icon name="dig" size={20} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700 }}>見つけたお店</span>
                <span style={{ fontFamily: font.dela, fontSize: 17 }}>{found}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>店</span>
                <Icon name="chevronRight" size={20} />
              </button>
            )}

            {/* ③-11 その人のハッシュタグ */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {tags.map((t) => (
                  <span key={t.id || t.name} style={{ height: 40, padding: '0 14px', borderRadius: 20, background: color.surface, color: color.ink, fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                    #{t.name}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => onInvite?.(data)} style={{ flex: '1 1 0%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="personAdd" size={20} color={color.white} />
                グループに招待する
              </button>
              <button type="button" aria-label="シェア" className="ui-btn" onClick={() => onShare?.(data)} style={{ flex: 'none', width: 56, height: 56, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', padding: 0, background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shareProfile" size={22} />
              </button>
            </div>

            {/* ③-11〜14 あなたとの相性 */}
            <CompatCard me={user} you={data} youName={name} onDiagnose={onDiagnose} />

            {/* ③-12 「○○さんの食スタイル」（4軸。押すとその人の結果） */}
            {type && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 26, paddingBottom: 6, borderBottom: `${stroke.shape}px solid ${color.ink}` }}>
                  <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{name}さんの食スタイル</h2>
                  <button type="button" className="ui-btn ui-btn--text" onClick={() => onOpenTypeResult?.(data)} style={{ flex: 'none', height: 44, padding: '0 2px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                    診断の結果
                    <Icon name="chevronRight" size={18} />
                  </button>
                </div>
                {AXIS_LABELS.map((ax) => {
                  const v = axesOf(data)[ax.key];
                  const pc = axisPercent(v);
                  const right = pc.right >= 50;
                  return (
                    <div key={ax.key} style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: 13, color: color.sub }}>{AXIS_META.find((m) => m.key === ax.key)?.badge}</span>
                        <span style={{ fontFamily: font.dela, fontSize: 17 }}>
                          {right ? ax.right : ax.left} {right ? pc.right : pc.left}%
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: 10, marginTop: 8, borderRadius: 5, background: color.surface }}>
                        {/* 多いほうの側から伸ばす（「映え 80%」なら左から80%） */}
                        <span style={{ position: 'absolute', [right ? 'right' : 'left']: 0, top: 0, bottom: 0, width: `${right ? pc.right : pc.left}%`, borderRadius: 5, background: AXIS_META.find((m) => m.key === ax.key)?.main || color.ink }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: color.sub }}>
                        <span>{ax.left}</span>
                        <span>{ax.right}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
      <MoreSheet
        open={more}
        onClose={() => setMore(false)}
        name={name}
        onReport={() => {
          setMore(false);
          setReport(true);
        }}
        onBlock={() => {
          setMore(false);
          setBlockConfirm(true);
        }}
      />
      {/* ㉖-16 その人が見つけたお店 */}
      {foundList && (
        <BottomSheet open onClose={() => setFoundList(null)} ariaLabel={`${name}さんが見つけたお店`} maxHeight="86%">
          <h2 style={{ margin: '12px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400 }}>{name}さんが見つけたお店</h2>
          <div style={{ marginTop: 12 }}>
            {foundList.map((f) => (
              <div key={f.shop_id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, borderTop: `1px solid ${color.line}` }}>
                <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 14, background: `#5E4B3C center/cover no-repeat url(${shopPhotoUrl(f.photo) || ''})` }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: color.sub }}>
                    {[f.genre_main, f.station_name && `${f.station_name}駅`].filter(Boolean).join('・')}
                  </span>
                </span>
                <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: color.sub }}>
                  <Icon name="heartFill" size={14} color={color.accent} />
                  {f.saved_count}
                </span>
              </div>
            ))}
            {foundList.length === 0 && <p style={{ margin: '16px 0 0', fontSize: 14, color: color.sub }}>まだありません</p>}
          </div>
        </BottomSheet>
      )}

      <ReportSheet open={report} onClose={() => setReport(false)} targetId={data.id} name={name} onBlockAfter={() => setBlockConfirm(true)} />
      <BottomSheet open={blockConfirm} onClose={() => setBlockConfirm(false)} ariaLabel={`${name} さんをブロックしますか？`} minHeight={230}>
        <h2 style={{ margin: '16px 0 0', fontFamily: font.dela, fontSize: 20, fontWeight: 400, lineHeight: 1.4, textAlign: 'center' }}>
          @{data.handle} さんを
          <br />
          ブロックしますか？
        </h2>
        <Button variant="danger" onClick={doBlock} style={{ marginTop: 18 }}>
          ブロックする
        </Button>
        <Button variant="secondary" onClick={() => setBlockConfirm(false)} style={{ marginTop: 10 }}>
          キャンセル
        </Button>
      </BottomSheet>
    </div>
  );
}
