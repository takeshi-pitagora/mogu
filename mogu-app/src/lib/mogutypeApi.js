// Mogu Type 連携（v2 仕様）：サイトの結果を読むだけ。マイページコードは使わない（引き渡し書 §0・§4）
const RESULT_API = 'https://mogutype.com/api/app/result';

// Safariで開くURL（§2・§4-2）。from=mogu-app を付けると、サイトの送るボタンが出る
export const DIAGNOSE_URL = 'https://mogutype.com/?from=mogu-app';
export const MYPAGE_URL = 'https://mogutype.com/mypage?from=mogu-app';

// フレンドコードの文字（0・1・I・L・O・U は使わない。§4-4）
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{8}$`);

// 全角を半角に（NFKC）→ 空白とハイフンを消す → 大文字にする（§4-4）
export function normalizeFriendCode(input) {
  return String(input || '')
    .normalize('NFKC')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

export function friendCodeFormatOk(code) {
  return CODE_RE.test(normalizeFriendCode(code));
}

// mogu://mogu-type/link?friendCode=... からフレンドコードを取り出す（§4-4）
export function parseFriendCodeFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'mogu:' || u.host !== 'mogu-type') return null;
    const path = `${u.pathname}`.replace(/^\/+/, '');
    if (path !== 'link') return null;
    const code = u.searchParams.get('friendCode');
    return code ? normalizeFriendCode(code) : null;
  } catch {
    return null;
  }
}

const ERROR_MESSAGES = {
  invalid_friend_code: 'コードは英数字8文字だよ。もう一度確認してね',
  not_found: 'そのフレンドコードの結果が見つかりませんでした。コードを確認してね',
  not_full_diagnosis: '新しい20問の診断をまだ受けていないみたい。モグタイプで診断してね',
  server_error: '今は結果を読み込めませんでした。少したってからもう一度試してね',
};

// GET /api/app/result（§5）。読み取り専用・認証なし
export async function fetchMoguTypeResult(friendCode) {
  const code = normalizeFriendCode(friendCode);
  if (!friendCodeFormatOk(code)) return { error: ERROR_MESSAGES.invalid_friend_code };
  let res;
  try {
    res = await fetch(`${RESULT_API}?friendCode=${encodeURIComponent(code)}`, { method: 'GET', cache: 'no-store' });
  } catch {
    return { error: '通信できませんでした。時間をおいてもう一度お試しください。' };
  }
  if (res.status === 404) {
    const body = await res.json().catch(() => null);
    return { error: body?.message || ERROR_MESSAGES.not_found };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { error: body?.message || ERROR_MESSAGES[body?.error] || ERROR_MESSAGES.server_error };
  }
  const data = await res.json().catch(() => null);
  if (!data || !data.typeCode) return { error: ERROR_MESSAGES.server_error };
  return { data };
}
