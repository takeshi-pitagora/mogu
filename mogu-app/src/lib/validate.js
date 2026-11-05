// 入力の決まり（確定版 Final-07・Final-05。パスワードの条件は仮）

// パスワード：8文字以上・英字と数字を含む
export const passwordRules = (pw) => [
  { label: '8文字以上', ok: String(pw || '').length >= 8 },
  { label: '英字と数字を含む', ok: /[A-Za-z]/.test(pw || '') && /[0-9]/.test(pw || '') },
];
export const passwordOk = (pw) => passwordRules(pw).every((r) => r.ok);

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

// ニックネーム：9文字まで（全角も1文字）
export const NICKNAME_MAX = 9;

// 新規登録の欄（ニックネーム・メールアドレス・パスワード）
export function validateSignup(v) {
  const errors = {};
  if (!v.nickname.trim()) errors.nickname = 'ニックネームを入れてください';
  if (!isEmail(v.email)) errors.email = 'メールアドレスの形が違います';
  if (!passwordOk(v.password)) errors.password = 'パスワードの条件を満たしていません';
  return errors;
}
