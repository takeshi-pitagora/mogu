const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const name = url.searchParams.get('name'); // 例: places/xxxx/photos/yyyy

  if (!name) {
    return new Response('name パラメータが必要です', { status: 400 });
  }

  const googleUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${GOOGLE_API_KEY}`;
  const res = await fetch(googleUrl);

  if (!res.ok) {
    return new Response('画像取得に失敗しました', { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // 1日キャッシュ
    },
  });
});