import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, signup, guestLogin } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  const resetMessages = () => {
    setErrorMessage('');
    setInfoMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setErrorMessage('メールアドレスを入力してください。');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('パスワードは6文字以上で入力してください。');
      return;
    }
    if (authMode === 'signup' && !displayName.trim()) {
      setErrorMessage('ニックネームを入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === 'login') {
        const { error } = await login(email.trim(), password);
        if (error) setErrorMessage(error);
      } else {
        const { error } = await signup(email.trim(), password, displayName.trim());
        if (error) {
          setErrorMessage(error);
        } else {
          setInfoMessage('登録が完了しました。確認メールが届いている場合はご確認のうえログインしてください。');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    resetMessages();
    setGuestSubmitting(true);
    try {
      const { error } = await guestLogin();
      if (error) setErrorMessage(error);
    } finally {
      setGuestSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto flex justify-center bg-stone-100">
      <div className="w-full sm:max-w-sm flex flex-col justify-between min-h-full bg-white text-stone-800 p-8 sm:shadow-2xl" style={{ paddingTop: 'calc(var(--safe-top) + 2rem)', paddingBottom: 'calc(var(--safe-bottom) + 2rem)' }}>

        {/* ロゴ・ウェルカム */}
        <div className="pt-12 text-center">
          <h1 className="text-5xl font-black tracking-tight text-stone-900 mb-2">mogu</h1>
          <p className="text-xs text-stone-500 font-medium tracking-wide">
            好みがぴったり合うお店を、ふたりで見つける
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">ニックネーム</label>
              <input
                type="text"
                required
                placeholder="例: もぐたろう"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-800"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">メールアドレス</label>
            <input
              type="email"
              required
              placeholder="mogu@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">パスワード</label>
            <input
              type="password"
              required
              placeholder="••••••••（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-800"
            />
          </div>

          {errorMessage && (
            <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {errorMessage}
            </p>
          )}
          {infoMessage && (
            <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-stone-900 hover:bg-black text-white font-bold text-sm rounded-2xl shadow-md active:scale-95 transition disabled:opacity-50"
          >
            {submitting ? '処理中...' : authMode === 'login' ? 'ログイン' : '新規アカウント登録'}
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={guestSubmitting}
            className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-2xl border border-stone-200 transition disabled:opacity-50"
          >
            {guestSubmitting ? '接続中...' : '登録せずにお試し（ゲストログイン）'}
          </button>
        </form>

        {/* モード切替 */}
        <div className="text-center pb-6">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              resetMessages();
            }}
            className="text-xs text-stone-500 underline font-medium"
          >
            {authMode === 'login'
              ? 'アカウントをお持ちでない方はこちら（新規登録）'
              : 'すでにアカウントをお持ちの方はこちら（ログイン）'}
          </button>
        </div>

      </div>
    </div>
  );
}
