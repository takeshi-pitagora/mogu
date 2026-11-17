import { supabase } from './supabase';
import { loadImage } from './photo';
import { PHOTO_MIN_SHORT_SIDE } from './registerForm';

// =============================================================
// お店の写真（⑱-5〜7・㉒）
//   短い辺が 720px 未満の写真は使えない（§9-2 の3。サーバーでも止める）
//   そのままの大きさは重いので、長い辺 1600 の「大きい方」と
//   カード用の長い辺 720 の2つを作って入れる（保存する量と通信を減らすため）
// =============================================================

const FULL_LONG = 1600;
const CARD_LONG = 720;
const BUCKET = 'shop-photos';

// 選んだ写真を読み、使えるかどうかと見本のURLを返す
export async function inspectPhoto(file) {
  const { img, url } = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const tooSmall = Math.min(width, height) < PHOTO_MIN_SHORT_SIDE;
  return { file, img, url, width, height, tooSmall };
}

// 長い辺を max に収めて描き直す（小さい写真はそのまま）
function resizeToBlob(img, max, quality = 0.86) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('写真を作れませんでした'))), 'image/jpeg', quality);
  });
}

function newPath(userId) {
  const rand = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${rand}`;
}

// 1枚を入れる。戻り値は register_shop に渡す形
export async function uploadShopPhoto(userId, photo) {
  const base = newPath(userId);
  const [full, card] = await Promise.all([
    resizeToBlob(photo.img, FULL_LONG),
    resizeToBlob(photo.img, CARD_LONG, 0.82),
  ]);

  const path = `${base}.jpg`;
  const cardPath = `${base}_c.jpg`;
  const up = async (p, blob) => {
    const { error } = await supabase.storage.from(BUCKET).upload(p, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
  };
  await up(path, full);
  await up(cardPath, card);

  // 入れたあとの大きさ（サーバーの「短い辺」の確かめは、入れた写真の大きさで見る）
  const scale = Math.min(1, FULL_LONG / Math.max(photo.width, photo.height));
  return {
    path,
    card_path: cardPath,
    kind: photo.kind || 'food',
    width: Math.round(photo.width * scale),
    height: Math.round(photo.height * scale),
  };
}

// 入れた写真を消す（登録に失敗したときの後始末）
export async function removeShopPhotos(paths) {
  if (!paths?.length) return;
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}
