// プッシュ通知の配信（引き渡し書 §7-6）。Capacitor（Expoではない）なので、自前でAPNsに送る
//
// 呼ばれ方：Supabase の Database Webhook（notificationsテーブルの INSERT）から呼ばれる想定。
//   Dashboard → Database → Webhooks → 新しいWebhook
//     テーブル: public.notifications / イベント: Insert / 種類: HTTP Request
//     URL: このEdge FunctionのURL（supabase functions deploy notify-dispatch のあと確認できます）
//     HTTP ヘッダーに追加（任意だが推奨）：x-webhook-secret: <NOTIFY_DISPATCH_WEBHOOK_SECRET と同じ値>
//
// 必要な環境変数（supabase secrets set で設定。どれもApple Developerのサイトで作る）：
//   APNS_KEY_P8        「キー」で作ったAPNs Auth Key（.p8ファイルの中身をそのまま）
//   APNS_KEY_ID         そのキーのID（10文字）
//   APNS_TEAM_ID        Apple DeveloperのチームID（10文字）
//   APNS_BUNDLE_ID      アプリのBundle ID（例: app.mogu.mobile）
//   APNS_ENV            'production'（App Store・TestFlight配信時はこちら）または 'sandbox'（Xcodeからの直接実行時）
//   NOTIFY_DISPATCH_WEBHOOK_SECRET  Webhookのヘッダーと比べる合言葉（省略すると確認しない）
//
// Android（FCM）はまだ未対応。push_tokens.platform='android' の行は今は無視する

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type NotifType = 'group_match' | 'member_joined' | 'id_invite' | 'announcement';

const TEXT: Record<NotifType, (p: Record<string, unknown>) => { title: string; body: string }> = {
  group_match: (p) => ({ title: 'マッチ！', body: `みんなが「${p.restaurant_name || 'お店'}」を選びました` }),
  member_joined: (p) => ({ title: '新しいメンバー', body: `${p.display_name || '新しいメンバー'}さんがグループに参加しました` }),
  id_invite: () => ({ title: '招待が届いています', body: 'グループに招待されました' }),
  announcement: (p) => ({ title: (p.title as string) || 'お知らせ', body: (p.body as string) || '' }),
};

const PREF_COLUMN: Record<NotifType, string> = {
  group_match: 'notif_match',
  member_joined: 'notif_member_joined',
  id_invite: 'notif_id_invite',
  announcement: 'notif_announcement',
};

// base64url（JWTで使う、パディングなし）
function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// .p8（PKCS8 PEM）から ECDSA P-256 の秘密鍵を読み込む
async function importApnsKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

let cachedJwt: { token: string; exp: number } | null = null;

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - now > 60) return cachedJwt.token;

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const p8 = Deno.env.get('APNS_KEY_P8');
  if (!keyId || !teamId || !p8) throw new Error('APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 が設定されていません。');

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${payload}`;
  const key = await importApnsKey(p8);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  const token = `${signingInput}.${b64url(sig)}`;
  cachedJwt = { token, exp: now + 50 * 60 }; // APNsのJWTは最長1時間。50分で作り直す
  return token;
}

async function sendOne(token: string, payload: Record<string, unknown>) {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const env = Deno.env.get('APNS_ENV') === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const jwt = await apnsJwt();
  const res = await fetch(`https://${env}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId || '',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, body, token };
  }
  return { ok: true, token };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POSTのみ対応しています。' }, 405);

  try {
    const secret = Deno.env.get('NOTIFY_DISPATCH_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return json({ error: '合言葉が一致しません。' }, 401);
    }

    const payload = await req.json().catch(() => null);
    const record = payload?.record;
    if (!record?.id || !record?.user_id || !record?.type) return json({ error: 'notificationsの行が見つかりませんでした。' }, 400);

    const type = record.type as NotifType;
    if (!TEXT[type]) return json({ ok: true, skipped: 'unknown_type' });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。' }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 本人の通知設定（マスター・種類別）を確認する
    const { data: profile } = await admin
      .from('profiles')
      .select(`notif_master, ${PREF_COLUMN[type]}`)
      .eq('id', record.user_id)
      .maybeSingle();
    if (profile && (profile.notif_master === false || profile[PREF_COLUMN[type]] === false)) {
      return json({ ok: true, skipped: 'muted_by_prefs' });
    }

    // グループのミュート設定（マッチ・新しいメンバーは、そのグループをミュートしていれば送らない）
    const groupId = record.payload?.group_id;
    if (groupId && (type === 'group_match' || type === 'member_joined')) {
      const { data: gm } = await admin.from('group_members').select('muted').eq('group_id', groupId).eq('user_id', record.user_id).maybeSingle();
      if (gm?.muted) return json({ ok: true, skipped: 'muted_by_group' });
    }

    const { data: tokens, error: tokenError } = await admin.from('push_tokens').select('token, platform').eq('user_id', record.user_id).eq('platform', 'ios');
    if (tokenError) throw new Error(tokenError.message);
    if (!tokens || tokens.length === 0) return json({ ok: true, skipped: 'no_token' });

    const { title, body } = TEXT[type](record.payload || {});
    const apsPayload = { aps: { alert: { title, body }, sound: 'default' }, type, payload: record.payload || {} };

    const results = await Promise.all(tokens.map((t: { token: string }) => sendOne(t.token, apsPayload)));
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) console.error('notify-dispatch: APNsへの送信に失敗したトークンがあります:', JSON.stringify(failed));

    return json({ ok: true, sent: results.length - failed.length, failed: failed.length });
  } catch (err) {
    console.error('notify-dispatch 失敗:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
