import { useEffect, useState } from 'react';
import { color, font, stroke } from '../../theme/tokens';
import BottomSheet from '../../components/ui/BottomSheet';
import Dig from '../../components/ui/Dig';
import logo from '../../assets/brand/mogu_logo_black.png';
import { supabase } from '../../lib/supabase';
import { shopPhotoUrl } from '../../lib/shops';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { canShareFiles, shareFiles } from '../../lib/open';
import { myRecord } from '../../lib/record';

// =============================================================
// ③-8 「○月のまとめを画像にする」
//   黒いカード（名前・○年○月・行ったお店の写真・3つの数字・dig・mogu）。
//   コインは出さない。［画像を保存する］［共有する］
// =============================================================

const SCALE = 3;
const W = 300 * SCALE;
const H = 420 * SCALE;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function draw({ name, month, record, photos }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const k = SCALE;
  const [y, m] = String(month).split('-');

  ctx.fillStyle = color.ink;
  roundRect(ctx, 0, 0, W, H, 24 * k);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#D9D4CE';
  ctx.font = `700 ${13 * k}px "IBM Plex Sans JP", sans-serif`;
  ctx.fillText(`${name || 'あなた'}の`, 22 * k, 36 * k);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `400 ${28 * k}px "Dela Gothic One", sans-serif`;
  ctx.fillText(`${y}年${Number(m)}月`, 22 * k, 68 * k);

  // 行ったお店の写真（3列・最大6枚）
  const cell = 56 * k;
  const gap = 6 * k;
  for (let i = 0; i < Math.min(photos.length, 6); i += 1) {
    const cx = 22 * k + (i % 3) * (cell + gap);
    const cy = 86 * k + Math.floor(i / 3) * (cell + gap);
    ctx.save();
    roundRect(ctx, cx, cy, cell, cell, 10 * k);
    ctx.clip();
    ctx.fillStyle = '#5E4B3C';
    ctx.fillRect(cx, cy, cell, cell);
    try {
      const img = await loadImage(photos[i]);
      const r = Math.max(cell / img.width, cell / img.height);
      ctx.drawImage(img, cx + (cell - img.width * r) / 2, cy + (cell - img.height * r) / 2, img.width * r, img.height * r);
    } catch { /* 読めない写真は地のまま */ }
    ctx.restore();
  }

  // 3つの数字
  const rows = [
    ['新しく見つけたお店', `${record.found}店`],
    ['いちばん行ったエリア', record.areas?.[0]?.name || '—'],
    ['夜のひとり平均', record.dinner != null ? `¥${Number(record.dinner).toLocaleString('ja-JP')}` : '—'],
  ];
  let ty = 232 * k;
  rows.forEach(([label, value]) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#B9B2A9';
    ctx.font = `500 ${12 * k}px "IBM Plex Sans JP", sans-serif`;
    ctx.fillText(label, 22 * k, ty);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `400 ${18 * k}px "Dela Gothic One", sans-serif`;
    ctx.fillText(value, W - 22 * k, ty + 3 * k);
    ty += 28 * k;
  });

  // dig（斜めに）
  ctx.save();
  ctx.translate(22 * k, 338 * k);
  ctx.transform(1, 0, -Math.tan((12 * Math.PI) / 180), 1, 0, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${17 * k}px "IBM Plex Sans JP", sans-serif`;
  ctx.fillText('dig', 0, 0);
  const w1 = ctx.measureText('dig').width;
  ctx.font = `400 ${21 * k}px "Dela Gothic One", sans-serif`;
  ctx.fillText(String(record.dig_to), w1 + 2 * k, 0);
  ctx.restore();

  // mogu の白いふだ
  const bw = W - 44 * k;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 22 * k, 356 * k, bw, 44 * k, 12 * k);
  ctx.fill();
  try {
    const mark = await loadImage(logo);
    const mh = 20 * k;
    const mw = (mark.width / mark.height) * mh;
    ctx.drawImage(mark, 22 * k + (bw - mw) / 2, 356 * k + (44 * k - mh) / 2, mw, mh);
  } catch { /* ロゴが読めないときは白いふだだけ */ }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export default function MonthImageSheet({ month, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [record, setRecord] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const from = month;
    const d = new Date(`${month}T00:00:00`);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const toIso = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
    Promise.all([
      myRecord(month),
      supabase.rpc('my_visit_calendar', { p_from: from, p_to: toIso }),
    ])
      .then(([r, cal]) => {
        if (!alive) return;
        setRecord(r);
        setPhotos((cal.data || []).map((x) => shopPhotoUrl(x.card_path)).filter(Boolean).slice(0, 6));
      })
      .catch(() => alive && setRecord(null));
    return () => { alive = false; };
  }, [month]);

  const make = async () => {
    if (!record) return null;
    return draw({ name: user?.name, month, record, photos });
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await make();
      if (!blob) throw new Error('画像を作れませんでした');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mogu-${month}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast?.show('画像を保存しました');
    } catch (err) {
      console.error('まとめ画像のエラー:', err?.message || err);
      toast?.show('画像を作れませんでした');
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await make();
      if (!blob) throw new Error('画像を作れませんでした');
      const file = new File([blob], `mogu-${month}.png`, { type: 'image/png' });
      if (canShareFiles([file])) {
        const ok = await shareFiles({ title: 'mogu', text: `${month} のまとめ`, files: [file] });
        if (!ok) toast?.show('シェアをキャンセルしました');
      } else {
        await onSave();
      }
    } catch (err) {
      console.error('まとめ画像のエラー:', err?.message || err);
      toast?.show('画像を作れませんでした');
    } finally {
      setBusy(false);
    }
  };

  const [y, m] = String(month).split('-');

  return (
    <BottomSheet open onClose={onClose} ariaLabel={`${Number(m)}月のまとめ`} maxHeight="92%">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, margin: '0 -8px' }}>
        <button type="button" onClick={onClose} className="ui-btn ui-btn--text" style={{ height: 44, padding: '0 8px', border: 0, background: 'transparent', color: color.ink, fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>
          キャンセル
        </button>
        <h2 style={{ margin: 0, fontFamily: font.dela, fontSize: 18, fontWeight: 400 }}>{Number(m)}月のまとめ</h2>
        <span style={{ width: 74 }} />
      </div>

      {/* 画面の中の見本（実際の画像も同じ並びで描く） */}
      <div style={{ width: 300, margin: '0 auto', padding: '18px 18px 16px', boxSizing: 'border-box', borderRadius: 24, background: color.ink, color: color.white }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#D9D4CE' }}>{user?.name || 'あなた'}の</div>
        <div style={{ marginTop: 2, fontFamily: font.dela, fontSize: 28, lineHeight: 1.1 }}>{y}年{Number(m)}月</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 6, marginTop: 14 }}>
          {photos.map((p) => (
            <span key={p} style={{ width: 56, height: 56, borderRadius: 10, background: `#5E4B3C url(${p}) center/cover no-repeat` }} />
          ))}
        </div>
        {record && (
          <div style={{ marginTop: 16 }}>
            {[['新しく見つけたお店', `${record.found}店`], ['いちばん行ったエリア', record.areas?.[0]?.name || '—'], ['夜のひとり平均', record.dinner != null ? `¥${Number(record.dinner).toLocaleString('ja-JP')}` : '—']].map(([k2, v]) => (
              <div key={k2} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#B9B2A9' }}>{k2}</span>
                <span style={{ fontFamily: font.dela, fontSize: 18 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <Dig n={record.dig_to} size={17} style={{ color: color.white }} />
            </div>
          </div>
        )}
        <div style={{ marginTop: 10, height: 44, borderRadius: 12, background: color.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={logo} alt="mogu" style={{ display: 'block', height: 20 }} />
        </div>
      </div>

      <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !record} onClick={onSave} style={{ width: '100%', height: 56, marginTop: 18, border: 0, borderRadius: 28, background: color.ink, color: color.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, opacity: busy || !record ? 0.6 : 1 }}>
        画像を保存する
      </button>
      <button type="button" className="ui-btn ui-btn--secondary" disabled={busy || !record} onClick={onShare} style={{ width: '100%', height: 56, marginTop: 12, boxSizing: 'border-box', border: `${stroke.shape}px solid ${color.ink}`, borderRadius: 28, background: color.white, color: color.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, opacity: busy || !record ? 0.6 : 1 }}>
        共有する
      </button>
    </BottomSheet>
  );
}
