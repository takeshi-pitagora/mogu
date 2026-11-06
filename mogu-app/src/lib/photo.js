// プロフィール写真：選ぶ・切り出す・保存する（引き渡し書 §7-2）
//   写真ライブラリ全体へのアクセスは求めない → <input type="file"> のiPhoneの標準の選択画面を使う
//   丸に合わせて切り出し、保存する前に長い辺1024pxまで小さくする
import { supabase } from './supabase';

const OUT_SIZE = 1024; // 保存する正方形の一辺（px）

// iPhoneの「写真を撮る」「ライブラリから選ぶ」をそれぞれ開く
export function pickImageFile({ camera = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.addEventListener(
      'change',
      () => {
        const file = input.files && input.files[0];
        document.body.removeChild(input);
        resolve(file || null);
      },
      { once: true }
    );
    // キャンセルされたときも、少し待って null を返す（change が来ない端末向け）
    window.addEventListener(
      'focus',
      () => setTimeout(() => { if (document.body.contains(input)) { document.body.removeChild(input); resolve(null); } }, 800),
      { once: true }
    );
    document.body.appendChild(input);
    input.click();
  });
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')); };
    img.src = url;
  });
}

// crop: { scale, offsetX, offsetY }（offset は切り出し窓の中心から見た画像中心のずれ・px、窓の大きさを基準に正規化済み）
export function cropToBlob(img, crop, mime = 'image/jpeg', quality = 0.9) {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_SIZE;
  canvas.height = OUT_SIZE;
  const ctx = canvas.getContext('2d');
  // 丸の外は保存しない（透過NGのJPEGなので、外側を白で塗ってから丸でクリップ）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(OUT_SIZE / 2, OUT_SIZE / 2, OUT_SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const baseScale = Math.max(OUT_SIZE / img.naturalWidth, OUT_SIZE / img.naturalHeight);
  const scale = baseScale * (crop?.scale || 1);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const cx = OUT_SIZE / 2 + (crop?.offsetX || 0);
  const cy = OUT_SIZE / 2 + (crop?.offsetY || 0);
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, quality));
}

// Storage の avatars バケットへ保存し、古い写真があれば消す。戻り値は profiles.avatar_path に入れる場所
export async function uploadAvatar(userId, blob, oldPath) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return { error: '写真を保存できませんでした。時間をおいて再度お試しください。' };
  if (oldPath) {
    await supabase.storage.from('avatars').remove([oldPath]).catch(() => {});
  }
  return { path };
}

export async function removeAvatar(path) {
  if (!path) return { success: true };
  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) return { error: '写真を削除できませんでした。時間をおいて再度お試しください。' };
  return { success: true };
}

// 通報のスクリーンショット（report-screenshots バケット。運営だけが読める）
export async function uploadReportScreenshot(userId, file) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('report-screenshots').upload(path, file, { upsert: false });
  if (error) return { error: '画像を送れませんでした。時間をおいて再度お試しください。' };
  return { path };
}
