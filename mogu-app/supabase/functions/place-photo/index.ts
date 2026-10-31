// 店舗写真のプロキシ。<img src> から直接呼ばれる（認証ヘッダーなし）。
//
// 仕組み:
//  0. 【保存済みならGoogleを呼ばない】Supabase Storage（バケット place-photos）に
//     同じ写真があれば、そこへ転送（302）して終わり。Googleの写真代は1枚につき最初の1回だけ。
//  1. 保存されていなければ、restaurants に登録済みのお店かを確認する
//     （登録されていない写真の指定は断る＝連打されても課金されない）
//  2. Google Places API (New) の写真メディアを取得し、Storage に保存してから返す
//  3. 写真IDが期限切れ（400/404）なら、店舗IDから最新の写真IDを取り直して表示し、
//     restaurants テーブルの写真URLも新しいものに更新する
//  4. それでも取れない場合（上限超過・請求エラーなど）は、壊れた画像の代わりに
//     プレースホルダー画像を返す（アプリの更新なしで「?」表示を防ぐ）
//  5. 失敗の理由は必ずログに残す（Supabase → Edge Functions → place-photo → Logs）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// 写真IDの形式: places/{placeId}/photos/{photoId}
// これ以外は受け付けない（無関係なリクエストでGoogleの課金が発生するのを防ぐ）
const NAME_PATTERN = /^places\/([A-Za-z0-9_-]+)\/photos\/([A-Za-z0-9_-]+)$/;
const PHOTO_COLUMNS = ['photo_food', 'photo_interior', 'photo_exterior'];

// 写真の保存先（公開バケット。無ければ自動で作る）
const BUCKET = 'place-photos';
const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// 写真ID → 保存ファイル名（places/{placeId}/photos/{photoId} → {placeId}/{photoId}.jpg）
function storageKey(name: string) {
  const m = name.match(NAME_PATTERN);
  return m ? `${m[1]}/${m[2]}.jpg` : null;
}

function publicUrl(key: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
}

// 保存済みの写真へ転送。端末側でも1日覚えておき、関数の呼び出し自体を減らす
function redirectTo(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'public, max-age=86400' },
  });
}

// 保存済みか（公開URLに HEAD で問い合わせる。Googleの課金は発生しない）
async function isStored(key: string) {
  try {
    const res = await fetch(publicUrl(key), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !/already exists/i.test(error.message)) {
      console.error('place-photo: バケットを作成できません', error.message);
      return;
    }
  }
  bucketChecked = true;
}

// Storage に保存する（失敗しても表示は続ける）
async function saveToStorage(keys: string[], bytes: Uint8Array, contentType: string) {
  try {
    await ensureBucket();
    for (const key of new Set(keys)) {
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(key, bytes, { contentType, upsert: true, cacheControl: '31536000' });
      if (error) console.error('place-photo: 保存に失敗', key, error.message);
    }
  } catch (err) {
    console.error('place-photo: 保存エラー', (err as Error).message);
  }
}

// restaurants に登録済みのお店か（未登録の写真はGoogleに問い合わせない）
async function isKnownPlace(placeId: string) {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('place_id', placeId)
    .limit(1);
  if (error) {
    console.error('place-photo: 店舗の確認に失敗', error.message);
    return true; // DBの一時的な不調で写真が全部消えないよう、確認できないときは通す
  }
  return (data || []).length > 0;
}

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="#EFE9DF"/>
<g fill="none" stroke="#B8AC9A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
<path d="M330 380v120c0 22 18 40 40 40v160M370 380v100M410 380v120c0 22-18 40-40 40"/>
<path d="M470 700V380c40 20 60 70 60 130h-60"/>
</g>
<text x="400" y="790" font-family="-apple-system, 'Hiragino Sans', sans-serif" font-size="34" font-weight="700" fill="#A0937F" text-anchor="middle">写真を準備中です</text>
</svg>`;

function buildPhotoProxyUrl(photoName: string) {
  return `${SUPABASE_URL}/functions/v1/place-photo?name=${encodeURIComponent(photoName)}`;
}

function placeholder(reason: string) {
  return new Response(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300', // 5分で再挑戦できるよう短めに
      'X-Mogu-Photo-Fallback': reason,
    },
  });
}

async function fetchMedia(name: string) {
  return await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${GOOGLE_API_KEY}`
  );
}

// 期限切れの写真IDを、店舗IDから取り直す。同じ並び順（料理/内観/外観）の写真を返す
async function refreshPhotoName(placeId: string, oldName: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY!, 'X-Goog-FieldMask': 'photos' },
  });
  if (!res.ok) {
    console.error('place-photo: 写真IDの再取得に失敗', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const photos: string[] = (data.photos || []).map((p: { name: string }) => p.name).filter(Boolean);
  if (photos.length === 0) return null;

  // restaurants テーブルの該当店舗を、新しい写真IDに更新する
  let index = 0;
  try {
    const supabase = supabaseAdmin;
    const { data: rows } = await supabase
      .from('restaurants')
      .select('id, photo_food, photo_interior, photo_exterior')
      .eq('place_id', placeId);

    const oldUrl = buildPhotoProxyUrl(oldName);
    const row = (rows || [])[0] as Record<string, unknown> | undefined;
    if (row) {
      const found = PHOTO_COLUMNS.findIndex((c) => row[c] === oldUrl || String(row[c] || '').includes(encodeURIComponent(oldName)));
      if (found >= 0) index = found;
    }

    const update: Record<string, string | null> = {};
    PHOTO_COLUMNS.forEach((col, i) => {
      update[col] = photos[i] ? buildPhotoProxyUrl(photos[i]) : null;
    });
    const { error } = await supabase.from('restaurants').update(update).eq('place_id', placeId);
    if (error) console.error('place-photo: restaurants の更新に失敗', error.message);
  } catch (err) {
    console.error('place-photo: DB更新エラー', (err as Error).message);
  }

  return photos[Math.min(index, photos.length - 1)];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') || '';
  const match = name.match(NAME_PATTERN);

  if (!match) {
    return new Response('name パラメータが不正です', { status: 400 });
  }
  if (!GOOGLE_API_KEY) {
    console.error('place-photo: GOOGLE_PLACES_API_KEY が未設定です');
    return placeholder('no-api-key');
  }

  const key = storageKey(name)!;

  try {
    // 0. 保存済み → Storage へ転送（Googleの課金なし）
    if (await isStored(key)) {
      return redirectTo(publicUrl(key));
    }

    // 1. 登録されていないお店の写真は取りに行かない
    if (!(await isKnownPlace(match[1]))) {
      console.warn('place-photo: 未登録の店舗のため取得しません', match[1]);
      return placeholder('unknown-place');
    }

    // 2. Google から取得
    let usedName = name;
    let res = await fetchMedia(name);

    // 写真IDの期限切れ・無効 → 取り直して再挑戦
    if (res.status === 400 || res.status === 404) {
      console.warn('place-photo: 写真IDが無効のため再取得します', res.status, await res.text());
      const freshName = await refreshPhotoName(match[1], name);
      if (freshName) {
        usedName = freshName;
        const freshKey = storageKey(freshName);
        // 新しい写真IDの分がすでに保存済みなら、それを使う
        if (freshKey && (await isStored(freshKey))) {
          return redirectTo(publicUrl(freshKey));
        }
        res = await fetchMedia(freshName);
      }
    }

    if (!res.ok) {
      const body = await res.text();
      // 429 = 1日の上限（クォータ）超過 / 403 = 請求・APIキーの問題
      console.error('place-photo: Googleから画像を取得できません', res.status, body);
      return placeholder(`google-${res.status}`);
    }

    // 3. 保存してから返す（古い写真IDのURLからでも、次回は保存分が使われるよう両方の名前で保存）
    const contentType = res.headers.get('Content-Type') || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    const keys = [key, storageKey(usedName)].filter(Boolean) as string[];
    await saveToStorage(keys, bytes, contentType);

    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1日キャッシュ
      },
    });
  } catch (err) {
    console.error('place-photo: 予期しないエラー', (err as Error).message);
    return placeholder('exception');
  }
});
