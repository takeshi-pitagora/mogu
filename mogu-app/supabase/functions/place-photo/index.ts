// 店舗写真のプロキシ。<img src> から直接呼ばれる（認証ヘッダーなし）。
//
// 仕組み:
//  1. Google Places API (New) の写真メディアを取得して返す
//  2. 写真IDが期限切れ（400/404）なら、店舗IDから最新の写真IDを取り直して表示し、
//     restaurants テーブルの写真URLも新しいものに更新する
//  3. それでも取れない場合（上限超過・請求エラーなど）は、壊れた画像の代わりに
//     プレースホルダー画像を返す（アプリの更新なしで「?」表示を防ぐ）
//  4. 失敗の理由は必ずログに残す（Supabase → Edge Functions → place-photo → Logs）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// 写真IDの形式: places/{placeId}/photos/{photoId}
// これ以外は受け付けない（無関係なリクエストでGoogleの課金が発生するのを防ぐ）
const NAME_PATTERN = /^places\/([A-Za-z0-9_-]+)\/photos\/([A-Za-z0-9_-]+)$/;
const PHOTO_COLUMNS = ['photo_food', 'photo_interior', 'photo_exterior'];

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
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: rows } = await supabase
      .from('restaurants')
      .select('id, photo_food, photo_interior, photo_exterior')
      .eq('place_id', placeId);

    const oldUrl = buildPhotoProxyUrl(oldName);
    const row = (rows || [])[0];
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

  try {
    let res = await fetchMedia(name);

    // 写真IDの期限切れ・無効 → 取り直して再挑戦
    if (res.status === 400 || res.status === 404) {
      console.warn('place-photo: 写真IDが無効のため再取得します', res.status, await res.text());
      const freshName = await refreshPhotoName(match[1], name);
      if (freshName) res = await fetchMedia(freshName);
    }

    if (!res.ok) {
      const body = await res.text();
      // 429 = 1日の上限（クォータ）超過 / 403 = 請求・APIキーの問題
      console.error('place-photo: Googleから画像を取得できません', res.status, body);
      return placeholder(`google-${res.status}`);
    }

    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // 1日キャッシュ
      },
    });
  } catch (err) {
    console.error('place-photo: 予期しないエラー', (err as Error).message);
    return placeholder('exception');
  }
});
