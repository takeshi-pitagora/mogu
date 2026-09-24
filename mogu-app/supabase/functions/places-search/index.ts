import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const CACHE_DAYS = 30;
const CACHE_MIN_COUNT = 8; // これ未満ならGoogleに再問い合わせ

// Google Places API (New) の priceLevel enum → 既存スキーマの1〜4に変換
function mapPriceLevel(level) {
  const map = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level] ?? null;
}

function buildPhotoProxyUrl(photoName) {
  if (!photoName) return null;
  return `${SUPABASE_URL}/functions/v1/place-photo?name=${encodeURIComponent(photoName)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { area } = await req.json();
    if (!area || !area.trim()) {
      return new Response(JSON.stringify({ error: 'area は必須です' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const trimmedArea = area.trim();

    // ① まずキャッシュを確認（Googleを叩かずに済ませられないか）
    const cacheThreshold = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached, error: cacheError } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('area', `%${trimmedArea}%`)
      .eq('is_excluded', false)
      .gte('cached_at', cacheThreshold)
      .order('rating', { ascending: false, nullsFirst: false });

    if (cacheError) throw cacheError;

    if (cached && cached.length >= CACHE_MIN_COUNT) {
      return new Response(JSON.stringify({ restaurants: cached, source: 'cache' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ② キャッシュ不足 → Google Places API (Text Search, New) を呼ぶ
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ restaurants: cached || [], source: 'cache_only_no_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const googleRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.priceLevel,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.photos,places.location,places.regularOpeningHours,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery: `${trimmedArea} レストラン`,
        languageCode: 'ja',
        regionCode: 'JP',
        maxResultCount: 20,
      }),
    });

    if (!googleRes.ok) {
      const errBody = await googleRes.text();
      console.error('Google Places API エラー:', errBody);
      return new Response(JSON.stringify({ restaurants: cached || [], source: 'cache_fallback' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const googleData = await googleRes.json();
    const places = googleData.places || [];

    // ③ 取得結果を restaurants テーブルに upsert（place_id が正式なGoogle ID）
    const nowIso = new Date().toISOString();
    const rows = places.map((p) => ({
      place_id: p.id,
      name: p.displayName?.text || '名称不明',
      area: trimmedArea,
      genre: p.primaryTypeDisplayName?.text || null,
      price_level: mapPriceLevel(p.priceLevel),
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingCount ?? null,
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      photo_food: buildPhotoProxyUrl(p.photos?.[0]?.name),
      photo_interior: buildPhotoProxyUrl(p.photos?.[1]?.name),
      photo_exterior: buildPhotoProxyUrl(p.photos?.[2]?.name),
      opening_hours: p.regularOpeningHours ?? null,
      website: p.websiteUri ?? null,
      is_excluded: false,
      source: 'google',
      cached_at: nowIso,
      updated_at: nowIso,
    }));

    let upserted = [];
    if (rows.length > 0) {
      const { data, error: upsertError } = await supabase
        .from('restaurants')
        .upsert(rows, { onConflict: 'place_id' })
        .select();
      if (upsertError) throw upsertError;
      upserted = data;
    }

    // キャッシュ分と新規分をマージして返す（重複除去）
    const merged = new Map();
    [...(cached || []), ...upserted].forEach((r) => merged.set(r.id, r));

    return new Response(
      JSON.stringify({ restaurants: Array.from(merged.values()), source: 'google' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('places-search エラー:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});