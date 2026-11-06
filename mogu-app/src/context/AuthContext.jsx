import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RESET_PASSWORD_URL } from '../lib/links';
import { translatePgError } from '../lib/profile';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
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
        avatar: null,
        foodStyle: '未診断',
        foodAxes: null,
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
      avatar: profile?.avatar || null,
      foodStyle: profile?.food_style || '未診断',
      foodAxes: profile?.food_axes || null, // 診断の4軸スコア {VT,NF,BG,PL}（0〜3）
      isGuest: false,
      // 2回目（プロフィールと安全）で足した列
      handle: profile?.handle || null,
      handleConfirmed: !!profile?.handle_confirmed,
      handlePromptedAt: profile?.handle_prompted_at || null,
      bio: profile?.bio || '',
      avatarPath: profile?.avatar_path || null,
      inviteScope: profile?.invite_scope || 'anyone',
      moguType: profile?.mogu_type_code
        ? {
            code: profile.mogu_type_code,
            characterName: profile.mogu_type_character_name,
            axisValues: profile.mogu_type_axis_values,
            friendCode: profile.mogu_type_friend_code,
            nickname: profile.mogu_type_nickname,
            completedAt: profile.mogu_type_completed_at,
            linkedAt: profile.mogu_type_linked_at,
          }
        : null,
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


  // 新規登録（サインアップ）。handle：新規登録のユーザーID欄（2回目）。渡さなければ仮のIDが自動で付く
  const signup = async (email, password, displayName, handle) => {

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
      },
    });

    if (error) {
      const text = translateAuthError(error);
      return { error: text, code: text.startsWith('このメールアドレスはすでに') ? 'email_taken' : undefined };
    }

    const newUser = data?.user;
    const newSession = data?.session;

    // メールの確認がオンのとき、登録済みのメールアドレスでもエラーにならず、identities が空で返る
    if (newUser && Array.isArray(newUser.identities) && newUser.identities.length === 0) {
      return { error: 'このメールアドレスはすでに登録されています', code: 'email_taken' };
    }

    if (newUser) {
      // insert ではなく upsert にすることで、
      // トリガー等により既にprofilesが作成済みでも 409 を起こさず安全に処理する
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: newUser.id,
            display_name: displayName || email.split('@')[0],
            ...(handle ? { handle } : {}),
          },
          { onConflict: 'id', ignoreDuplicates: false }
        );

      if (profileError) {
        console.error('プロフィール作成エラー:', profileError.message);
        // ユーザーIDだけが原因（2人が同時に同じIDを取ろうとした、など）なら、ID無しでもう一度作る
        if (handle) {
          await supabase
            .from('profiles')
            .upsert({ id: newUser.id, display_name: displayName || email.split('@')[0] }, { onConflict: 'id', ignoreDuplicates: false });
          return { data, session: newSession, handleError: translatePgError(profileError) };
        }
      }
    }

    return { data, session: newSession };
  };

  // パスワードの再設定メール（メールのリンクは GitHub Pages の再設定ページを開く）
  // 登録されていないメールアドレスでも、画面には同じ「メールを送りました」を出す
  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_PASSWORD_URL });
    if (error && (error.status === 429 || /rate limit/i.test(error.message || ''))) {
      return { error: '少したってから、もう一度お試しください' };
    }
    if (error && /fetch|network/i.test(error.message || '')) return { error: '通信できません' };
    return { success: true };
  };

  // パスワードの変更：今のパスワードを確かめてから変える
  const changePassword = async (current, next) => {
    if (!user?.email) return { error: 'ログイン情報が見つかりません。' };
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (e1) {
      if (/Invalid login credentials/i.test(e1.message || '')) return { error: '今のパスワードが違います', field: 'current' };
      return { error: translateAuthError(e1) };
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      if (/different from the old/i.test(error.message || '')) return { error: '今のパスワードと違うものにしてください', field: 'next' };
      return { error: translateAuthError(error) };
    }
    return { success: true };
  };

  // ゲストのまま登録する（同じ利用者にメールとパスワードを付けるので、保存したお店は残る。引き渡し書 §7-8）
  const convertGuest = async ({ email, password, displayName, handle }) => {
    if (!user?.isGuest) return { error: 'ゲストではありません。' };
    const { data, error } = await supabase.auth.updateUser({ email, password, data: { display_name: displayName } });
    if (error) {
      const msg = error.message || '';
      if (/already|registered|exists/i.test(msg)) return { error: 'このメールアドレスはすでに登録されています', code: 'email_taken' };
      return { error: translateAuthError(error) };
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName, ...(handle ? { handle } : {}) }, { onConflict: 'id', ignoreDuplicates: false });
    let handleErrorText;
    if (profileError) {
      console.error('プロフィール作成エラー:', profileError.message);
      if (handle) {
        await supabase.from('profiles').upsert({ id: user.id, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: false });
        handleErrorText = translatePgError(profileError);
      }
    }
    // メールの確認がオンのときは、確認が終わるまでメールアドレスは new_email のまま
    const pending = !!data?.user?.new_email;
    await loadProfile(data?.user ?? null);
    return { success: true, pendingEmail: pending, handleError: handleErrorText };
  };

  const guestLogin = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { error: translateAuthError(error) };
    return { data };
  };

  // updates は camelCase のキーだけ渡す（渡さなかった項目は変えない）
  //   name / avatar / foodStyle（今まで通り）、handle / bio / avatarPath / inviteScope（2回目）
  const COLUMN_MAP = {
    name: 'display_name',
    avatar: 'avatar',
    foodStyle: 'food_style',
    handle: 'handle',
    bio: 'bio',
    avatarPath: 'avatar_path',
    inviteScope: 'invite_scope',
  };
  const updateProfile = async (updates) => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    if (user.isGuest) return { error: 'ゲストアカウントはプロフィールを保存できません。' };

    const payload = {};
    for (const key of Object.keys(updates)) {
      if (COLUMN_MAP[key]) payload[COLUMN_MAP[key]] = updates[key];
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);

    if (error) {
      console.error('プロフィール更新エラー:', error.message);
      return { error: translatePgError(error) };
    }

    setUser((prev) => ({ ...prev, ...updates }));
    return { success: true };
  };

  // Mogu Type連携（v2仕様 §4-7）：サイトのAPIで取ってきた結果を保存する。マイページコードは保存しない
  const linkMoguType = async (friendCode, result) => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    if (user.isGuest) return { error: 'ゲストアカウントでは連携できません。' };
    const payload = {
      mogu_type_friend_code: friendCode,
      mogu_type_code: result.typeCode,
      mogu_type_character_name: result.characterName,
      mogu_type_axis_values: result.axisValues,
      mogu_type_nickname: result.nickname || null,
      mogu_type_completed_at: result.completedAt ? new Date(result.completedAt).toISOString() : null,
      mogu_type_linked_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (error) {
      console.error('Mogu Type連携エラー:', error.message);
      return { error: translatePgError(error) };
    }
    setUser((prev) => ({
      ...prev,
      moguType: {
        code: result.typeCode,
        characterName: result.characterName,
        axisValues: result.axisValues,
        friendCode,
        nickname: result.nickname || null,
        completedAt: payload.mogu_type_completed_at,
        linkedAt: payload.mogu_type_linked_at,
      },
    }));
    return { success: true };
  };

  // §4-9：連携を解除する（サイト側には何も送らない）
  const unlinkMoguType = async () => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    const { error } = await supabase
      .from('profiles')
      .update({
        mogu_type_friend_code: null,
        mogu_type_code: null,
        mogu_type_character_name: null,
        mogu_type_axis_values: null,
        mogu_type_nickname: null,
        mogu_type_completed_at: null,
        mogu_type_linked_at: null,
      })
      .eq('id', user.id);
    if (error) {
      console.error('Mogu Type連携解除エラー:', error.message);
      return { error: translatePgError(error) };
    }
    setUser((prev) => ({ ...prev, moguType: null }));
    return { success: true };
  };

  // Mogu Type 診断の結果を保存する（タイプコード・4軸スコア・キャラのアイコン）
  // ゲストはサーバーに保存できないため、この画面の間だけ表示に反映する
  const saveDiagnosis = async ({ code, axes, avatarId }) => {
    if (!user) return { error: 'ログイン情報が見つかりません。' };
    // 診断日をマイページのチケットに出すため、4軸スコアと一緒に at（ISO日時）を保存する
    const storedAxes = { ...axes, at: new Date().toISOString() };
    const local = { foodStyle: code, foodAxes: storedAxes, avatar: avatarId };
    if (user.isGuest) {
      setUser((prev) => ({ ...prev, ...local }));
      return { success: true, localOnly: true };
    }

    let { error } = await supabase
      .from('profiles')
      .update({ food_style: code, food_axes: storedAxes, avatar: avatarId })
      .eq('id', user.id);

    // food_axes 列がまだ無いDBでも、タイプとアイコンだけは保存できるようにする
    if (error && /food_axes/.test(error.message || '')) {
      console.warn('food_axes 列が見つからないため、タイプとアイコンのみ保存します。');
      ({ error } = await supabase
        .from('profiles')
        .update({ food_style: code, avatar: avatarId })
        .eq('id', user.id));
    }

    if (error) {
      console.error('診断結果の保存エラー:', error.message);
      return { error: '診断結果を保存できませんでした。時間をおいて再度お試しください。' };
    }
    setUser((prev) => ({ ...prev, ...local }));
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

  // 「IDを決めよう」を出したことを残す（1度だけ出すため）
  const markHandlePrompted = async () => {
    if (!user || user.isGuest) return;
    await supabase.rpc('mark_handle_prompted');
    setUser((prev) => ({ ...prev, handlePromptedAt: new Date().toISOString() }));
  };

  const value = { user, loading, login, signup, guestLogin, logout, deleteAccount, updateProfile, saveDiagnosis, linkMoguType, unlinkMoguType, resetPassword, changePassword, convertGuest, markHandlePrompted };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 確定版 Final-07 の言葉に合わせる。field はどの欄のまちがいか（email / password / form）
function translateAuthError(error) {
  const msg = error?.message || '';
  if (msg.includes('already registered') || msg.includes('User already registered')) {
    return 'このメールアドレスはすでに登録されています';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'メールアドレスかパスワードが違います';
  }
  if (msg.includes('Password should be at least') || /weak.?password/i.test(msg)) {
    return 'パスワードの条件を満たしていません';
  }
  if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('invalid')) {
    return 'メールアドレスの形が違います';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '通信できません。電波のよい場所で、もう一度お試しください';
  }
  if (msg.includes('Anonymous sign-ins are disabled')) {
    return 'いまはゲストで使えません。少したってから、もう一度お試しください';
  }
  if (error?.status === 429 || /rate limit/i.test(msg)) {
    return '少したってから、もう一度お試しください';
  }
  return '読み込めませんでした。少したってから、もう一度お試しください';
}
