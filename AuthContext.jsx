import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使用してください。');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUser) => {
    if (!authUser) {
      setUser(null);
      return;
    }

    if (authUser.is_anonymous) {
      setUser({
        id: authUser.id,
        email: null,
        name: 'ゲスト',
        avatar: '🍓',
        foodStyle: '未診断',
        isGuest: true,
      });
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('プロフィール取得エラー:', error.message);
    }

    setUser({
      id: authUser.id,
      email: authUser.email,
      name: profile?.display_name || authUser.email?.split('@')[0] || 'ユーザー',
      avatar: profile?.avatar || '🍓',
      foodStyle: profile?.food_style || '未診断',
      isGuest: false,
    });
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      loadProfile(session?.user ?? null).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error) };
    return { data };
  };


  // 新規登録（サインアップ）
  const signup = async (email, password, displayName) => {
    if (password.length < 6) {
      return { error: 'パスワードは6文字以上で入力してください。' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
      },
    });

    if (error) {
      if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
        return {
          error: '登録リクエストが多すぎます。しばらく時間をおいてから再度お試しください。',
        };
      }
      return { error: translateAuthError(error) };
    }

    const newUser = data?.user;
    const newSession = data?.session;

    if (newUser) {
      // insert ではなく upsert にすることで、
      // トリガー等により既にprofilesが作成済みでも 409 を起こさず安全に処理する
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: newUser.id,
            display_name: displayName || email.split('@')[0],
          },
          { onConflict: 'id', ignoreDuplicates: false }
        );

      if (profileError) {
        console.error('プロフィール作成エラー:', profileError.message);
      }
    }

    return { data, session: newSession };
  };

  const guestLogin = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { error: translateAuthError(error) };
    return { data };
  };

  const updateProfile = async (updates) => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    if (user.isGuest) return { error: 'ゲストアカウントはプロフィールを保存できません。' };

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: updates.name,
        avatar: updates.avatar,
        food_style: updates.foodStyle,
      })
      .eq('id', user.id);

    if (error) {
      console.error('プロフィール更新エラー:', error.message);
      return { error: '保存に失敗しました。時間をおいて再度お試しください。' };
    }

    setUser((prev) => ({ ...prev, ...updates }));
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // アカウント削除（App Store 5.1.1(v) 対応）
  // Edge Function 側で本人確認・関連データ削除・auth.users 削除までを行う。
  const deleteAccount = async () => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    if (user.isGuest) return { error: 'ゲストアカウントには削除対象のデータがありません。' };

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { error: 'セッションが確認できませんでした。再度ログインしてください。' };
    }

    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.error('アカウント削除エラー:', error.message);
      return { error: '削除に失敗しました。時間をおいて再度お試しください。' };
    }

    await supabase.auth.signOut();
    setUser(null);
    return { success: true };
  };

  const value = { user, loading, login, signup, guestLogin, logout, deleteAccount, updateProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function translateAuthError(error) {
  const msg = error?.message || '';
  if (msg.includes('already registered') || msg.includes('User already registered')) {
    return 'このメールアドレスは既に登録されています。';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }
  if (msg.includes('Password should be at least')) {
    return 'パスワードは6文字以上で入力してください。';
  }
  if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('invalid')) {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'ネットワークエラーが発生しました。接続環境をご確認ください。';
  }
  if (msg.includes('Anonymous sign-ins are disabled')) {
    return 'ゲストログインは現在利用できません。管理者にお問い合わせください。';
  }
  return `エラーが発生しました: ${msg}`;
}