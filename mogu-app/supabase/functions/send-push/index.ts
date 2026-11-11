// notifications テーブルに1件入るたびに、本人の端末へプッシュ通知を送る（引き渡し書 §7-6）
// 呼ばれ方：Database Webhook（notifications テーブルの INSERT）から呼ばれる想定。
//   Dashboard → Database → Webhooks → 新しいWebhook
//     テーブル: public.notifications / イベント: Insert / 種類: HTTP Request
//     URL: このEdge FunctionのURL
//     HTTP ヘッダーに x-webhook-secret: <PUSH_WEBHOOK_SECRET と同じ値>（任意だが推奨）
//
// 送り先は APNs（Apple Push Notification service）。トークン認証（.p8の鍵）を使うので、
// 証明書の更新は要らない。必要な環境変数（supabase secrets set で設定）：
//   APNS_KEY_ID       Apple Developer で作った「Auth Key」のキーID（例：ABCD1234EF）
//   APNS_TEAM_ID      Apple Developer の「チームID」（例：A1B2C3D4E5）
//   APNS_BUNDLE_ID    アプリのBundle ID（例：com.kazuki.mogu）
//   APNS_PRIVATE_KEY  Auth Key（.p8）の中身をそのまま（-----BEGIN PRIVATE KEY----- を含む）
//   PUSH_WEBHOOK_SECRET  Webhookのヘッダーと比べる合言葉（省略すると確認しない）
//
// 届かなかった端末（登録が切れた・アプリを消した）のトークンは、
// APNs が 400/410 を返したときに push_tokens から消す（ゴミを残さないため）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ---- 通知の種類ごとの文言（引き渡し書 §7-6 の表のとおり） ----
function textFor(type: string, payload: Record<string, unknown>) {
  const groupName = String(payload.group_name ?? '');
  const restaurantName = String(payload.restaurant_name ?? '');
  const displayName = String(payload.display_name ?? payload.inviter_display_name ?? '');
  switch (type) {
    case 'group_match':
      return { title: 'mogu', body: `${restaurantName}がマッチしました。${payload.member_count ?? ''}人全員がいいねしています` };
    case 'group_join':
      return { title: 'mogu', body: `${displayName}さんが参加しました` };
    case 'group_id_invite':
      return { title: 'mogu', body: `${displayName}さんから、${groupName}に招待されました` };
    case 'announcement':
      return { title: 'mogu', body: String(payload.title ?? 'お知らせがあります') };
    default:
      return { title: 'mogu', body: 'お知らせがあります' };
  }
}

// ---- APNs トークン認証（ES256 のJWT）を作る。Web Crypto（crypto.subtle）だけで署名できる ----
let cachedJwt: { token: string; exp: number } | null = null;

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  arr.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function apnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - now > 300) return cachedJwt.token;

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const privateKeyPem = Deno.env.get('APNS_PRIVATE_KEY');
  if (!keyId || !teamId || !privateKeyPem) throw new Error('APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY が未設定です');

  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: keyId })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: now })));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(privateKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  const token = `${signingInput}.${base64url(sig)}`;
  cachedJwt = { token, exp: now + 3300 }; // APNsの鍵は最長1時間。55分でつくり直す
  return token;
}

async function sendOne(deviceToken: string, title: string, body: string, custom: Record<string, unknown>) {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  if (!bundleId) throw new Error('APNS_BUNDLE_ID が未設定です');
  const jwt = await apnsJwt();
  const res = await fetch(`https://api.push.apple.com/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, ...custom }),
  });
  return res;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POSTのみ対応しています。' }, 405);

  try {
    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return json({ error: '合言葉が一致しません。' }, 401);
    }

    const payload = await req.json().catch(() => null);
    const record = payload?.record;
    if (!record?.id || !record?.user_id) return json({ error: 'notifications の行が見つかりませんでした。' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Supabaseの接続情報が未設定です。' }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: tokens, error: tokenErr } = await admin
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', record.user_id);
    if (tokenErr) {
      console.error('send-push: push_tokens の取得に失敗', tokenErr.message);
      return json({ error: tokenErr.message }, 500);
    }
    const iosTokens = (tokens || []).filter((t) => t.platform === 'ios');
    if (iosTokens.length === 0) return json({ success: true, sent: 0, reason: 'no-tokens' });

    const { title, body } = textFor(record.type, record.payload || {});
    const custom = { mogu_type: record.type, mogu_payload: record.payload || {} };

    let sent = 0;
    const deadTokens: string[] = [];
    for (const t of iosTokens) {
      try {
        const res = await sendOne(t.token, title, body, custom);
        if (res.ok) {
          sent += 1;
        } else if (res.status === 400 || res.status === 410) {
          deadTokens.push(t.token);
        } else {
          console.error('send-push: APNsから失敗', res.status, await res.text());
        }
      } catch (err) {
        console.error('send-push: 送信エラー', (err as Error).message);
      }
    }

    if (deadTokens.length > 0) {
      await admin.from('push_tokens').delete().eq('user_id', record.user_id).in('token', deadTokens);
    }

    return json({ success: true, sent, removed: deadTokens.length });
  } catch (err) {
    console.error('send-push 失敗:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
