import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import VisitCalendar from './VisitCalendar';
import StampBookCard from './StampBookCard';
import RecordReceipt from './RecordReceipt';
import { myDig } from '../../lib/dig';
import Dig from '../../components/ui/Dig';
import { fetchUserTags } from '../../lib/shops';
import { useAuth } from '../../context/AuthContext';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { photoUrlOf } from '../../lib/profile';
import { LOGO } from '../../lib/brand';
import { APP_STORE_URL } from '../../lib/links';
import { canShareFiles, shareFiles } from '../../lib/open';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import BottomSheet from '../../components/ui/BottomSheet';
import ProfileEditSheet from './ProfileEditSheet';
import { useToast } from '../../components/ui/Toast';

// プロフィール（確定版 Final-03 吹き出し型）の1回目の範囲（実装計画 6章 #4）
//   今あるデータで出せる所だけ：左の列にモグキャラ（129×197）とタイプのラベル、右にニックネーム（Dela 24）、
//   ［プロフィールを編集］、食スタイル診断のカード。右上に歯車（設定）
//   写真・@ID・自己紹介の吹き出し・［シェア］・［診断結果を取り込む］は2回目
//   食スタイル診断は1回目は今のアプリの20問（2回目でサイトの診断に置き換える）

// 未診断の「？」を押したとき（確定版 Final-03 の 7）。1回目は［診断結果を取り込む］とフレンドコードの一文を出さない
function FindCharaSheet({ open, onClose, onDiagnose }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="モグキャラを見つける">
      <h2 style={{ margin: '18px 0 0', fontFamily: font.dela, fontSize: 22, fontWeight: 400 }}>あなたのモグキャラを見つけよう</h2>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6 }}>診断すると、モグキャラが吹き出しであなたを紹介します。</p>
      <button type="button" className="ui-btn ui-btn--primary" onClick={onDiagnose} style={{ height: 52, marginTop: 16, border: 0, borderRadius: 26, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
        診断を受ける
      </button>
    </BottomSheet>
  );
}

// ③シェア画像（確定版 Final-03-7「BeReal 型」）。360×640（9:16）の形をそのまま3倍で描く
//   地はグループの淡い色、上に写真のカード（下の黒い帯に名前と@ID）、
//   その下の左にQRコード、右にモグキャラとタイプ・キャラ名、左下に mogu のロゴ
//   QRコードの飛び先は mogu の App Store のページ（lib/links.js の APP_STORE_URL）
const SHARE_SCALE = 3;
const SHARE_W = 360 * SHARE_SCALE;
const SHARE_H = 640 * SHARE_SCALE;

async function drawShareImage({ user, type, ch, photoUrl }) {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  const k = SHARE_SCALE;
  const g = type ? groupColor[groupOf(type.code)] : null;

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // 地（グループの淡い色）
  ctx.fillStyle = g ? g.light : color.surface;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // 写真のカード（left 20・right 20・top 24・高さ 300・角 28）
  const cardX = 20 * k;
  const cardY = 24 * k;
  const cardW = SHARE_W - 40 * k;
  const cardH = 300 * k;
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 28 * k);
  ctx.clip();
  ctx.fillStyle = '#5E4B3C';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  if (photoUrl) {
    try {
      const img = await loadImage(photoUrl);
      // 写真はカードいっぱいに、切り取って合わせる
      const r = Math.max(cardW / img.width, cardH / img.height);
      const dw = img.width * r;
      const dh = img.height * r;
      ctx.drawImage(img, cardX + (cardW - dw) / 2, cardY + (cardH - dh) / 2, dw, dh);
    } catch {
      /* 読み込めないときは地のまま */
    }
  }
  // カードの下の黒い帯（名前と@ID）
  const bandH = 66 * k;
  ctx.fillStyle = color.ink;
  ctx.fillRect(cardX, cardY + cardH - bandH, cardW, bandH);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `400 ${22 * k}px "Dela Gothic One", sans-serif`;
  ctx.fillText(user.name || 'mogu', cardX + 18 * k, cardY + cardH - bandH + 32 * k);
  if (user.handle) {
    ctx.fillStyle = '#D9D4CE';
    ctx.font = `400 ${12 * k}px "IBM Plex Sans JP", sans-serif`;
    ctx.fillText(`@${user.handle}`, cardX + 18 * k, cardY + cardH - bandH + 52 * k);
  }
  ctx.restore();

  // QRコード（136×136・left 24・top 384）
  const qrImg = await loadImage(await QRCode.toDataURL(APP_STORE_URL, { width: 136 * k, margin: 0, color: { dark: '#2E2C2A', light: '#0000' } }));
  ctx.drawImage(qrImg, 24 * k, 384 * k, 136 * k, 136 * k);

  // モグキャラ（148×226・left 186・top 340）とその下のタイプ・キャラ名
  if (ch) {
    const charaImg = await loadImage(ch.framed);
    ctx.drawImage(charaImg, 186 * k, 340 * k, 148 * k, 226 * k);
    ctx.textAlign = 'center';
    const cx = (186 + 148 / 2) * k;
    ctx.fillStyle = g ? g.dark : color.ink;
    ctx.font = `400 ${13 * k}px "Dela Gothic One", sans-serif`;
    ctx.fillText(type.code, cx, 585 * k);
    ctx.fillStyle = color.ink;
    ctx.font = `700 ${15 * k}px "IBM Plex Sans JP", sans-serif`;
    ctx.fillText(type.name, cx, 606 * k);
  }

  // 左下の mogu のロゴ（高さ 24・left 24・top 586）
  const logo = await loadImage(LOGO.black);
  const logoH = 24 * k;
  ctx.drawImage(logo, 24 * k, 586 * k, logoH * (logo.width / logo.height), logoH);

  // ふち
  ctx.strokeStyle = color.ink;
  ctx.lineWidth = 2 * k;
  roundRectPath(ctx, k, k, SHARE_W - 2 * k, SHARE_H - 2 * k, 24 * k);
  ctx.stroke();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function roundRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// ③ 自分のハッシュタグ（プロフィールの編集で選んだもの）
function MyTags({ userId }) {
  const [tags, setTags] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchUserTags(userId).then((rows) => alive && setTags(rows));
    return () => {
      alive = false;
    };
  }, [userId]);
  if (tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
      {tags.map((t) => (
        <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 10px', borderRadius: 8, background: color.surface, fontSize: 13, fontWeight: 700 }}>
          #{t.name}
        </span>
      ))}
    </div>
  );
}

export default function ProfileScreen({ onOpenSettings, onOpenDiagnosis, onOpenShop, onOpenStampBook, onOpenRegister, onOpenNotebook }) {
  const { user } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [find, setFind] = useState(false);
  const [hop, setHop] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);
  // ③-1 写真の右下の dig（押すと㉖ 探検手帳）
  const [dig, setDig] = useState(1);
  useEffect(() => {
    let alive = true;
    myDig()
      .then((d) => alive && setDig(d?.dig || 1))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const onOpenDig = () => onOpenNotebook?.();

  if (!user) return null;
  const type = getType(user.moguType?.code);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;

  // ③-10 名前の横のモグキャラを押す → 食スタイル診断の結果。まだのときは案内のシート
  const onChara = () => {
    if (!type) {
      setFind(true);
      return;
    }
    setHop(true);
    setTimeout(() => setHop(false), 260);
    onOpenDiagnosis?.();
  };

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await drawShareImage({ user, type, ch, photoUrl: photoUrlOf(user.avatarPath) });
      if (!blob) throw new Error('画像の生成に失敗しました');
      const file = new File([blob], 'mogu-profile.png', { type: 'image/png' });
      if (canShareFiles([file])) {
        const ok = await shareFiles({ title: 'mogu', text: `${user.name || ''}のmoguプロフィール`, files: [file] });
        if (!ok) toast?.show('シェアをキャンセルしました');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mogu-profile.png';
        a.click();
        URL.revokeObjectURL(url);
        toast?.show('画像を保存しました');
      }
    } catch (err) {
      console.error('シェア画像の生成エラー:', err?.message || err);
      toast?.show('シェア画像を作れませんでした');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: color.bg, fontFamily: font.plex, color: color.ink }}>
      <header style={{ flex: 'none', paddingTop: 'var(--safe-top)', background: color.bg }}>
        <div style={{ height: 44, padding: '0 8px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* ③-1 いちばん上に @ID（確定版 Final-03-Profile） */}
          <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{user.handle || ''}</span>
          <button type="button" aria-label="設定" onClick={onOpenSettings} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gear" size={24} />
          </button>
        </div>
      </header>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '8px 16px 130px' }}>
          {/* ③-1 写真（88・右下に dig）・名前・モグキャラのふだ（確定版 Final-03-Profile の 1・15） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flex: 'none' }}>
              <Avatar size={88} photoUrl={photoUrlOf(user.avatarPath)} name={user.name} label="写真" />
              <button
                type="button"
                onClick={onOpenDig}
                aria-label={`dig${dig}（押すと探検手帳）`}
                className="ui-btn"
                style={{ position: 'absolute', right: -14, bottom: -12, minWidth: 52, minHeight: 44, boxSizing: 'border-box', padding: '0 4px 10px 0', border: 0, background: 'transparent', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', color: color.ink }}
              >
                <Dig n={dig} size={14.6} outline />
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 8px' }}>
              <h1 className="no-zoom" style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{user.name}</h1>
              <button
                type="button"
                onClick={onChara}
                className="ui-btn"
                aria-label={type ? `モグキャラ ${type.code} ${type.name}（押すと診断の結果）` : 'モグキャラはまだありません（押すと診断の案内）'}
                style={{ flex: 'none', height: 34, padding: type ? '0 12px 0 5px' : '0 12px 0 8px', border: 0, borderRadius: 17, background: type ? (g ? g.light : color.surface) : color.surface, color: color.ink, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transform: hop ? 'translateY(-3px)' : 'none', transition: 'transform 0.13s ease-out' }}
              >
                {type ? (
                  <>
                    {ch?.display && <img src={ch.display} alt="" style={{ display: 'block', width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                    <span style={{ fontFamily: font.dela, fontSize: 13, color: g ? g.dark : color.ink }}>{type.code}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{type.name}</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', border: `${stroke.shape}px solid ${color.sub}`, color: color.sub, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: color.sub }}>未診断</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {user.bio && <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, overflowWrap: 'anywhere' }}>{user.bio}</p>}
          <MyTags userId={user.id} />
          {/* ③-1 ハッシュタグの下に［プロフィールを編集する］とシェア（確定版 Final-03-Profile の 1） */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setEdit(true)} style={{ flex: '1 1 0%', height: 56, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700 }}>
              プロフィールを編集する
            </button>
            <button
              type="button"
              aria-label="シェア"
              className="ui-btn"
              disabled={sharing}
              onClick={onShare}
              style={{ flex: 'none', width: 56, height: 56, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', padding: 0, background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sharing ? 0.6 : 1 }}
            >
              <Icon name="shareProfile" size={22} />
            </button>
          </div>
          {/* ③スタンプ帳-1 ［プロフィールを編集する］の下・「行ったお店」の上 */}
          <StampBookCard onOpen={onOpenStampBook} />
          {/* ③ 行ったお店のカレンダー（第5回） */}
          <VisitCalendar onOpenShop={onOpenShop} />
          {/* ③-3〜5 記録のレシート（第5回） */}
          <RecordReceipt onRegister={onOpenRegister} />
          <span ref={cardRef} />
        </div>
      </div>

      <FindCharaSheet
        open={find}
        onClose={() => setFind(false)}
        onDiagnose={() => {
          setFind(false);
          onOpenDiagnosis?.();
        }}
      />
      {edit && (
        <ProfileEditSheet
          onClose={() => setEdit(false)}
          onDiagnose={() => {
            // ⑥はシートを閉じてから開く。重ねて開くとシートの下に隠れてしまう（4回目 §3-1）
            setEdit(false);
            onOpenDiagnosis?.();
          }}
        />
      )}
    </div>
  );
}
