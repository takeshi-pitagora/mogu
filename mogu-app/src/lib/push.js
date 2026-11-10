// =============================================================
// プッシュ通知のトークン登録（3回目 §7-6）。Capacitorなので配信は自前のAPNs（notify-dispatch）
//   iOSのみ対応。@capacitor/push-notifications が無い・権限が無い環境では何もしない（エラーにしない）
//   Androidはまだ配信の仕組み（FCM）を用意していないため、登録はしても送られることはない
// =============================================================
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

let registered = false;

async function loadPlugin() {
  try {
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  } catch {
    return null;
  }
}

// 現在の許可状態（'granted' | 'denied' | 'prompt' | 'unsupported'）
export async function pushPermissionState() {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const PushNotifications = await loadPlugin();
  if (!PushNotifications) return 'unsupported';
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive;
  } catch {
    return 'unsupported';
  }
}

// 許可をお願いして、許可されたらAPNsに登録し、トークンをサーバーに送る
export async function requestPushPermissionAndRegister() {
  if (!Capacitor.isNativePlatform() || registered) return false;
  const PushNotifications = await loadPlugin();
  if (!PushNotifications) return false;

  try {
    const { receive } = await PushNotifications.requestPermissions();
    if (receive !== 'granted') return false;

    PushNotifications.addListener('registration', async (token) => {
      try {
        await supabase.rpc('register_push_token', { p_token: token.value, p_platform: Capacitor.getPlatform() });
      } catch (err) {
        console.error('プッシュトークンの登録に失敗:', err?.message || err);
      }
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('プッシュ通知の登録エラー:', err);
    });

    await PushNotifications.register();
    registered = true;
    return true;
  } catch (err) {
    console.error('プッシュ通知の許可のお願いに失敗:', err?.message || err);
    return false;
  }
}
