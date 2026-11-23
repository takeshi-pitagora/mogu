import { supabase } from './supabase';
import { loadImage } from './photo';
import { PHOTO_MIN_SHORT_SIDE } from './registerForm';

// =============================================================
// お店の写真（⑱-5〜7・㉒）
//   短い辺が 720px 未満の写真は使えない（§9-2 の3。サーバーでも止める）
//   そのままの大きさは重いので、長い辺 1600 の「大きい方」と
//   カード用の長い辺 720 の2つを作って入れる（保存する量と通信を減らすため）
//
//   iPhone の写真は 1枚 4032×3024（約1200万画素）ある。WebView が使える
//   メモリは少ないので、原寸のまま何枚も持っていると画面ごと落ちる。
//   ここでは「選んだ時点で長い辺 1600 に小さくして、原寸は捨てる」ことで
//   持ち続ける量を 1枚あたり 1/8 ほどにしている
// =============================================================

const FULL_LONG = 1600;
const CARD_LONG = 720;
const BUCKET = 'shop-photos';

// 使い終わったキャンバスを手放す。iOS はこれをしないとメモリが戻らない
function release(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

// 長い辺を max に収めて描く。一気に縮めると粗くなるので、半分ずつ近づける
function drawScaled(img, max) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  let cur = document.createElement('canvas');
  cur.width = sw;
  cur.height = sh;
  cur.getContext('2d').drawImage(img, 0, 0);

  let w = sw;
  let h = sh;
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  while (w > tw * 2) {
    const next = document.createElement('canvas');
    next.width = Math.max(tw, Math.round(w / 2));
    next.height = Math.max(th, Math.round(h / 2));
    const ctx = next.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, next.width, next.height);
    release(cur);
    cur = next;
    w = next.width;
    h = next.height;
  }
  if (w !== tw || h !== th) {
    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, tw, th);
    release(cur);
    return out;
  }
  return cur;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('写真を作れませんでした'))), 'image/jpeg', quality);
  });
}

// 長い辺を max に収めた JPEG を作る（作り終わったらキャンバスは手放す）
async function resizeToBlob(img, max, quality = 0.86) {
  const canvas = drawScaled(img, max);
  try {
    return await canvasToBlob(canvas, quality);
  } finally {
    release(canvas);
  }
}

// 選んだ写真を読み、使えるかどうかと見本のURLを返す。
//   原寸は持ち続けず、長い辺 1600 に小さくしたものだけを残す
export async function inspectPhoto(file) {
  const { img, url } = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const tooSmall = Math.min(width, height) < PHOTO_MIN_SHORT_SIDE;

  if (tooSmall || Math.max(width, height) <= FULL_LONG) {
    // 小さい写真はそのままでよい
    return { file, img, url, width, height, tooSmall };
  }

  // 作業用に小さくして、原寸の画像と URL は捨てる
  const blob = await resizeToBlob(img, FULL_LONG);
  URL.revokeObjectURL(url);
  img.src = '';
  const small = await loadImage(blob);
  return { file, img: small.img, url: small.url, width, height, tooSmall };
}

function newPath(userId) {
  const rand = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${rand}`;
}

// 1枚を入れる。戻り値は register_shop に渡す形
export async function uploadShopPhoto(userId, photo) {
  const base = newPath(userId);
  // 2つを同時に作らない（同時だとキャンバスが2枚ぶん同時に要って、落ちやすい）
  const full = await resizeToBlob(photo.img, FULL_LONG);
  const card = await resizeToBlob(photo.img, CARD_LONG, 0.82);

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
