// =============================================================
// プッシュ通知の宛先（APNs）。3回目（グループと通知）：引き渡し書 §7-6
// 「通知の許可のお願い」シートで［通知をオンにする］を押したときだけ、iPhoneの許可を聞く
// =============================================================
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

const isNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// 今すでに許可されているか（起動時に静かに確かめるだけ。ここでは聞かない）
export async function pushPermissionStatus() {
  if (!isNative()) return 'unsupported';
  try {
    const r = await PushNotifications.checkPermissions();
    return r.receive; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unsupported';
  }
}

// ［通知をオンにする］を押したときだけ呼ぶ。ここで初めて iPhone の許可ダイアログが出る
export async function requestPushPermission() {
  if (!isNative()) return 'unsupported';
  const r = await PushNotifications.requestPermissions();
  if (r.receive === 'granted') {
    await PushNotifications.register();
  }
  return r.receive;
}

// 端末トークンが取れたら Supabase に登録する。App.jsx で1度だけ listener を付ける
export function listenForPushToken() {
  if (!isNative()) return () => {};
  const reg = PushNotifications.addListener('registration', async (token) => {
    try {
      await supabase.rpc('register_push_token', { p_token: token.value, p_platform: 'ios' });
    } catch (err) {
      console.error('プッシュ通知トークンの登録エラー:', err?.message || err);
    }
  });
  const err = PushNotifications.addListener('registrationError', (e) => {
    console.error('プッシュ通知の登録エラー:', e?.error || e);
  });
  return () => {
    reg.remove();
    err.remove();
  };
}

// 起動時：すでに許可済みなら、黙ってトークンを取り直す（iPhoneの許可は聞かない）
export async function reRegisterIfAllowed() {
  if (!isNative()) return;
  const status = await pushPermissionStatus();
  if (status === 'granted') {
    try {
      await PushNotifications.register();
    } catch {
      /* 失敗しても起動は続ける */
    }
  }
}

// 「通知の許可のお願い」は、初めてグループに入ったときに1度だけ（画面ごとの仕様 ⑩）
const GROUP_JOIN_PROMPT_KEY = 'mogu_notif_group_join_prompt_shown';
export function hasSeenGroupJoinPrompt() {
  try {
    return localStorage.getItem(GROUP_JOIN_PROMPT_KEY) === '1';
  } catch {
    return true; // 読めない環境では、二度と出さない側に倒す
  }
}
export function markGroupJoinPromptSeen() {
  try {
    localStorage.setItem(GROUP_JOIN_PROMPT_KEY, '1');
  } catch {
    /* 無視 */
  }
}

// 通知をタップして開いたとき（type/payload を受け取って、App.jsx で画面を開く）
export function listenForPushTap(onTap) {
  if (!isNative()) return () => {};
  const l = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification?.data || {};
    onTap?.({ type: data.mogu_type, payload: data.mogu_payload });
  });
  return () => l.remove();
}
