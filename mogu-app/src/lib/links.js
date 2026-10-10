// 公開Webページの置き場所（docs/ フォルダを GitHub Pages で公開したURL）。
// 公開元を変えたときは、この1行だけ書き換えればよい。
export const SITE_BASE_URL = 'https://takeshi-pitagora.github.io/mogu';

// 問い合わせ先（ヘルプ・サポートページ・プライバシーポリシーと同じアドレス）
export const SUPPORT_EMAIL = 'nha824620@gmail.com';

export const PRIVACY_POLICY_URL = `${SITE_BASE_URL}/privacy-policy.html`;

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
