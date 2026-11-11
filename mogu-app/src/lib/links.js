// 公開Webページの置き場所（docs/ フォルダを GitHub Pages で公開したURL）。
// 公開元を変えたときは、この1行だけ書き換えればよい。
export const SITE_BASE_URL = 'https://takeshi-pitagora.github.io/mogu';

// 問い合わせ先（ヘルプ・サポートページ・プライバシーポリシーと同じアドレス）
export const SUPPORT_EMAIL = 'nha824620@gmail.com';

export const PRIVACY_POLICY_URL = `${SITE_BASE_URL}/privacy-policy.html`;
export const TERMS_URL = `${SITE_BASE_URL}/terms.html`;

// ヘルプ（よくある質問）：今のサポートページ（よくある質問とお問い合わせ先）
export const HELP_URL = `${SITE_BASE_URL}/support.html`;

// パスワードの再設定メールのリンクの開き先（新しいパスワードを決めるページ）
export const RESET_PASSWORD_URL = `${SITE_BASE_URL}/reset-password.html`;

// 「お店の情報について」「運営者」のページ。文章を受け取ってページを置いたら URL を入れる（それまで設定の行は出さない）
export const SHOP_INFO_URL = null;
export const OPERATOR_URL = null;

// 招待リンク。アプリ内（capacitor://localhost）のURLではなく、
// 誰でも開ける公開ページを指す。コードは ?code= に入る。
export const buildInviteLink = (token) => `${SITE_BASE_URL}/invite.html?code=${token}`;

// 招待リンク・コード・旧形式（/invite/xxxx）のどれが貼られても、トークン部分だけを取り出す。
export const extractInviteToken = (raw) => {
  const text = (raw || '').trim();
  const byQuery = text.match(/[?&]code=([A-Za-z0-9-]+)/);
  if (byQuery) return byQuery[1];
  if (text.includes('/invite/')) return text.split('/invite/').pop().split(/[?#]/)[0];
  return text;
};

// mogu://group/join?code=... （QRコード・招待ページからの呼び出し。引き渡し書 §7-5・§10「招待のリンクとQRのURLの形」）
export const buildGroupJoinScheme = (token) => `mogu://group/join?code=${encodeURIComponent(token)}`;
export const parseGroupJoinFromUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'mogu:' || u.host !== 'group') return null;
    const path = `${u.pathname}`.replace(/^\/+/, '');
    if (path !== 'join') return null;
    const code = u.searchParams.get('code');
    return code ? extractInviteToken(code) : null;
  } catch {
    return null;
  }
};
