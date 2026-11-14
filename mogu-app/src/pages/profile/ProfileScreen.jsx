import { useRef, useState } from 'react';
import QRCode from 'qrcode';
import { color, font, groupColor, groupOf, stroke } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { getType } from '../../lib/mogutype';
import { chara } from '../../lib/chara';
import { photoUrlOf } from '../../lib/profile';
import { AXIS_LABELS, axisPercent } from '../../lib/axis';
import { LOGO } from '../../lib/brand';
import { buildProfileLink } from '../../lib/links';
import { canShareFiles, shareFiles } from '../../lib/open';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import BottomSheet from '../../components/ui/BottomSheet';
import TypeLabel from '../../components/ui/TypeLabel';
import ProfileEditSheet from './ProfileEditSheet';
import { useToast } from '../../components/ui/Toast';

// プロフィール（確定版 Final-03 吹き出し型）の1回目の範囲（実装計画 6章 #4）
//   今あるデータで出せる所だけ：左の列にモグキャラ（129×197）とタイプのラベル、右にニックネーム（Dela 24）、
//   ［プロフィールを編集］、食スタイル診断のカード。右上に歯車（設定）
//   写真・@ID・自己紹介の吹き出し・［シェア］・［診断結果を取り込む］は2回目
//   食スタイル診断は1回目は今のアプリの20問（2回目でサイトの診断に置き換える）

const formatJa = (iso, withYear = true) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return withYear ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : `${d.getMonth() + 1}月${d.getDate()}日`;
};

function AxisBar({ label, value, g }) {
  // value：0（左そのもの）〜3（右そのもの）
  const { left, right } = axisPercent(value);
  const leftStrong = left >= right;
  const strong = { fontWeight: 700, color: color.ink };
  const weak = { fontWeight: 500, color: color.sub };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={leftStrong ? strong : weak}>
          <span>{label.left}</span> <span style={{ fontFamily: font.dela }}>{left}%</span>
        </span>
        <span style={leftStrong ? weak : strong}>
          <span style={{ fontFamily: font.dela }}>{right}%</span> <span>{label.right}</span>
        </span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', height: 16, marginTop: 6, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 8, overflow: 'hidden' }}>
        <span style={{ width: `${left}%`, background: leftStrong ? g.dark : g.light }} />
        <span style={{ width: 2, background: color.ink }} />
        <span style={{ flex: '1 1 0%', background: leftStrong ? g.light : g.dark }} />
      </div>
    </div>
  );
}

function DiagnosisCard({ user, type, onDiagnose }) {
  if (!type) {
    return (
      <section style={{ marginTop: 20, padding: '22px 20px 20px', borderRadius: 32, background: color.surface, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 22, fontWeight: 400 }}>あなたのモグキャラは？</h2>
        <p style={{ margin: 0, fontSize: 13, color: color.sub }}>Mogu Typeで診断すると、キャラがあなたを紹介し始めます</p>
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => onDiagnose('diagnose')} style={{ height: 52, marginTop: 4, border: 0, borderRadius: 26, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
          診断を受ける
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => onDiagnose('import')} style={{ height: 52, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 26, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
          診断結果を取り込む
        </button>
      </section>
    );
  }
  const g = groupColor[groupOf(type.code)] || { dark: color.ink, light: color.surface };
  // 2回目：食スタイル診断は Mogu Type 連携の値（mogu_type_axis_values）を使う。今までの20問の結果（food_axes）は使わない
  const axes = user.moguType?.axisValues;
  const date = formatJa(user.moguType?.linkedAt);
  return (
    <section id="profile-diagnosis" style={{ marginTop: 20, padding: '20px 18px 18px', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 32 }}>
      <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>食スタイル診断</h2>
      {axes && (
        <div role="img" aria-label={AXIS_LABELS.map((a) => `${a.left} ${axisPercent(axes[a.key] ?? 1.5).left}%`).join('、')} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {AXIS_LABELS.map((a) => (
            <AxisBar key={a.key} label={a} value={Number.isFinite(Number(axes[a.key])) ? Number(axes[a.key]) : 1.5} g={g} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: color.sub }}>{date ? `${date}に連携` : ''}</span>
        <button type="button" className="ui-btn ui-btn--small" onClick={onDiagnose} style={{ height: 44, padding: '0 16px', boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 22, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
          結果を更新
        </button>
      </div>
    </section>
  );
}

// 名前の横の写真・@ID・自己紹介の吹き出し（確定版 Final-03。連携済みはキャラ名の吹き出し、未診断は「自己紹介」の灰色の箱）
function IntroBlock({ user, type, g }) {
  const charaName = type?.name;
  const bubbleBg = type ? (g ? g.light : color.surface) : color.surface;
  return (
    <div style={{ flex: '0 0 auto', width: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar size={40} photoUrl={photoUrlOf(user.avatarPath)} name={user.name} label="写真" />
        <span style={{ minWidth: 0, fontSize: 13, color: color.sub, overflowWrap: 'anywhere' }}>@{user.handle || ''}</span>
      </div>
      <h1 className="no-zoom" style={{ margin: '8px 0 0', fontFamily: font.dela, fontSize: 24, fontWeight: 400, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</h1>
      <div style={{ position: 'relative', marginTop: 12, width: 220, padding: '10px 10px 12px', border: `${stroke.shape}px solid ${type ? color.ink : color.surface}`, borderRadius: 22, background: bubbleBg }}>
        {type && (
          <span aria-hidden="true" style={{ position: 'absolute', left: -11, top: 22, width: 18, height: 18, borderLeft: `${stroke.shape}px solid ${color.ink}`, borderBottom: `${stroke.shape}px solid ${color.ink}`, background: bubbleBg, transform: 'rotate(45deg)' }} />
        )}
        <span style={{ position: 'relative', display: 'block', fontSize: 12, fontWeight: 700, color: type ? color.ink : color.sub }}>
          {type ? `${charaName}が紹介します` : '自己紹介'}
        </span>
        {user.bio ? (
          <p style={{ position: 'relative', width: '14em', margin: '4px 0 0', fontSize: 14, lineHeight: 1.65, overflowWrap: 'anywhere' }}>{user.bio}</p>
        ) : null}
      </div>
    </div>
  );
}

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

// ③シェア画像：9:16。上に写真・名前・@ID、下にQR（左）とモグキャラ（右）、左下にmoguロゴ（4回目 §7）
//   QRの飛び先は「プロフィールを見る」用の別URL（lib/links.js の buildProfileLink。未確定・要確認）
async function drawShareImage({ user, type, ch, photoUrl }) {
  const canvas = document.createElement('canvas');
  const w = 1080;
  const h = 1920;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  ctx.fillStyle = '#EFEBE4';
  ctx.fillRect(0, 0, w, h);

  // 左上：moguロゴ
  const logo = await loadImage(LOGO.black);
  const logoW = w * 0.22;
  ctx.drawImage(logo, 64, 64, logoW, logoW * (logo.height / logo.width));

  // 写真（丸）
  const avatarSize = 260;
  const avatarX = (w - avatarSize) / 2;
  const avatarY = 300;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.clip();
  if (photoUrl) {
    try {
      const img = await loadImage(photoUrl);
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
    } catch {
      // 読み込めないときは白丸のまま
    }
  }
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2E2C2A';
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // 名前・@ID
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2E2C2A';
  ctx.font = '400 56px "Dela Gothic One", sans-serif';
  ctx.fillText(user.name || 'mogu', w / 2, avatarY + avatarSize + 100);
  if (user.handle) {
    ctx.font = '400 32px "IBM Plex Sans JP", sans-serif';
    ctx.fillStyle = '#6B6560';
    ctx.fillText(`@${user.handle}`, w / 2, avatarY + avatarSize + 150);
  }

  // 下段：QR（左）とモグキャラ（右）
  const boxY = 980;
  const boxSize = 440;
  const gap = 40;
  const totalW = boxSize * 2 + gap;
  const leftX = (w - totalW) / 2;
  const rightX = leftX + boxSize + gap;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#2E2C2A';
  ctx.lineWidth = 4;
  roundRectPath(ctx, leftX, boxY, boxSize, boxSize, 28);
  ctx.fill();
  ctx.stroke();
  const link = user.handle ? buildProfileLink(user.handle) : '';
  if (link) {
    const qrImg = await loadImage(await QRCode.toDataURL(link, { width: boxSize, margin: 1, color: { dark: '#2E2C2A', light: '#FFFFFF' } }));
    const pad = boxSize * 0.08;
    ctx.drawImage(qrImg, leftX + pad, boxY + pad, boxSize - pad * 2, boxSize - pad * 2);
  }

  const charaBg = type ? groupColor[groupOf(type.code)] : null;
  ctx.fillStyle = charaBg ? charaBg.light : '#FFFFFF';
  roundRectPath(ctx, rightX, boxY, boxSize, boxSize, 28);
  ctx.fill();
  ctx.stroke();
  if (ch) {
    const charaImg = await loadImage(ch.framed);
    const imgH = boxSize * 0.78;
    const imgW = imgH * (charaImg.width / charaImg.height);
    ctx.drawImage(charaImg, rightX + (boxSize - imgW) / 2, boxY + boxSize - imgH - 16, imgW, imgH);
    ctx.fillStyle = charaBg ? charaBg.dark : '#2E2C2A';
    ctx.font = '400 20px "Dela Gothic One", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(type.code, rightX + boxSize / 2, boxY + 36);
    ctx.font = '700 22px "IBM Plex Sans JP", sans-serif';
    ctx.fillStyle = '#2E2C2A';
    ctx.fillText(type.name, rightX + boxSize / 2, boxY + 64);
  } else {
    ctx.fillStyle = '#2E2C2A';
    ctx.font = '400 120px "Dela Gothic One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('？', rightX + boxSize / 2, boxY + boxSize / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // 下：合言葉
  ctx.fillStyle = '#6B6560';
  ctx.font = '400 28px "IBM Plex Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('mogu でつながろう', w / 2, boxY + boxSize + 90);

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

export default function ProfileScreen({ onOpenSettings, onOpenDiagnosis }) {
  const { user } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [find, setFind] = useState(false);
  const [hop, setHop] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);
  if (!user) return null;
  const type = getType(user.moguType?.code);
  const ch = type ? chara(type.code) : null;
  const g = type ? groupColor[groupOf(type.code)] : null;

  const onChara = () => {
    if (!type) {
      setFind(true);
      return;
    }
    setHop(true);
    setTimeout(() => setHop(false), 260);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        <div style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ width: 44 }} />
          <button type="button" aria-label="設定" onClick={onOpenSettings} className="ui-btn ui-btn--text" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gear" size={24} />
          </button>
        </div>
      </header>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '8px 16px 130px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
            <button
              type="button"
              onClick={onChara}
              aria-label={type ? `モグキャラ ${type.code} ${type.name}（押すと診断カードへ）` : 'モグキャラはまだありません（押すと診断の案内）'}
              style={{ flex: 'none', width: 129, padding: 0, border: 0, background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, color: color.ink, fontFamily: 'inherit' }}
            >
              {ch ? (
                <img src={ch.framed} alt="" style={{ display: 'block', width: 129, height: 197, objectFit: 'contain', objectPosition: 'center bottom', transform: hop ? 'translateY(-10px)' : 'none', transition: 'transform 0.13s ease-out' }} />
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 129, height: 197, fontFamily: font.dela, fontSize: 120, lineHeight: 1, color: color.ink }}>？</span>
              )}
              {type && <TypeLabel code={type.code} />}
            </button>
            <IntroBlock user={user} type={type} g={g} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setEdit(true)} style={{ flex: '1 1 0%', height: 52, border: 0, borderRadius: 26, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
              プロフィールを編集
            </button>
            <button
              type="button"
              aria-label="シェア"
              className="ui-btn"
              disabled={sharing}
              onClick={onShare}
              style={{ flex: 'none', width: 52, height: 52, border: `${stroke.shape}px solid ${color.ink}`, borderRadius: '50%', padding: 0, background: color.white, color: color.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sharing ? 0.6 : 1 }}
            >
              <Icon name="shareProfile" size={22} />
            </button>
          </div>
          <div ref={cardRef}>
            <DiagnosisCard user={user} type={type} onDiagnose={onOpenDiagnosis} />
          </div>
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
