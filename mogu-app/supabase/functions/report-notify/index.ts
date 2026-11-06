// 通報を受け付けたら、運営にメールで知らせる（引き渡し書 §7-3・migrations/20261107_round2.sql のコメントのとおり）
//
// 呼ばれ方：Supabase の Database Webhook（reports テーブルの INSERT）から呼ばれる想定。
//   Dashboard → Database → Webhooks → 新しいWebhook
//     テーブル: public.reports / イベント: Insert / 種類: HTTP Request
//     URL: このEdge FunctionのURL（supabase functions deploy report-notify のあと確認できます）
//     HTTP ヘッダーに追加（任意だが推奨）：x-webhook-secret: <REPORT_NOTIFY_WEBHOOK_SECRET と同じ値>
//
// 必要な環境変数（supabase secrets set で設定）：
//   RESEND_API_KEY            Resendのサイトで作ったAPIキー
//   REPORT_NOTIFY_TO          通知を受け取るメールアドレス（運営のメール）
//   REPORT_NOTIFY_FROM        送信元（省略時は Resend のテスト用アドレス。自分のドメインを認証すればそれを使える）
//   REPORT_NOTIFY_WEBHOOK_SECRET  Webhookのヘッダーと比べる合言葉（省略すると確認しない）
//
// reports テーブルはアプリから直接読めない（RLSでふさいでいる）ので、本文は record の中身だけで組み立てる。
// 送信できたら reports.notified_at を記録する（service role を使う。失敗してもメール送信自体は成功しているので無視する）

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const KIND_LABEL: Record<string, string> = { user: '利用者', group: 'グループ', general: '（相手を指定しない）' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POSTのみ対応しています。' }, 405);

  try {
    const secret = Deno.env.get('REPORT_NOTIFY_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return json({ error: '合言葉が一致しません。' }, 401);
    }

    const payload = await req.json().catch(() => null);
    const record = payload?.record;
    if (!record?.id) return json({ error: 'reportsの行が見つかりませんでした。' }, 400);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('REPORT_NOTIFY_TO');
    if (!apiKey || !to) {
      console.error('report-notify: RESEND_API_KEY / REPORT_NOTIFY_TO が設定されていません。');
      return json({ error: 'メールの送信先が設定されていません。' }, 500);
    }
    const from = Deno.env.get('REPORT_NOTIFY_FROM') || 'mogu <onboarding@resend.dev>';

    const snap = record.snapshot || {};
    const lines = [
      `種類: ${KIND_LABEL[record.kind] ?? record.kind}`,
      `理由: ${record.reason}`,
      record.detail ? `くわしい内容: ${record.detail}` : null,
      record.target_handle ? `相手のID（入力）: @${record.target_handle}` : null,
      snap.handle ? `相手のID: @${snap.handle}` : null,
      snap.display_name ? `相手の名前: ${snap.display_name}` : null,
      snap.group_name ? `グループ名: ${snap.group_name}` : null,
      record.target_user_id ? `相手のユーザーID（DB）: ${record.target_user_id}` : null,
      record.target_group_id ? `グループID（DB）: ${record.target_group_id}` : null,
      `通報者のユーザーID（DB）: ${record.reporter_id ?? '（退会済みなど不明）'}`,
      record.screenshot_paths?.length ? `スクリーンショット: ${record.screenshot_paths.length}枚（report-screenshots バケット）` : null,
      `通報ID: ${record.id}`,
      `日時: ${record.created_at}`,
    ].filter(Boolean);

    const subject = `【mogu 通報】${KIND_LABEL[record.kind] ?? record.kind} / ${record.reason}`;
    const text = lines.join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('report-notify: Resendでの送信に失敗:', res.status, body);
      return json({ error: 'メールを送れませんでした。' }, 502);
    }

    // 送れたことを記録する（失敗してもメールは送れているので、ここは無視してよい）
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (SUPABASE_URL && SERVICE_KEY) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from('reports').update({ notified_at: new Date().toISOString() }).eq('id', record.id);
      }
    } catch (e) {
      console.error('report-notify: notified_at の更新に失敗:', (e as Error).message);
    }

    return json({ success: true });
  } catch (err) {
    console.error('report-notify 失敗:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
