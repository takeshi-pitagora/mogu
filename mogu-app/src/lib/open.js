// 外のページを開く（iPhone では Safari が開く。Capacitor の今の動きのまま）
export function openExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// 共有（iPhone の共有シート）。使えない端末では false
export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
export async function shareText({ title, text, url }) {
  if (!canShare()) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}

// 画像を保存（QRのポスターなど）。iPhoneでは共有シートを開き、そこから「画像を保存」で写真に入れてもらう
// （写真への直接保存には別の権限つきプラグインが必要なため、今ある @capacitor/filesystem・@capacitor/share で動く形にしている）
export async function saveImageDataUrl(dataUrl, filename) {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
    return true;
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const base64 = dataUrl.split(',')[1] || '';
  const res = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ url: res.uri, dialogTitle: '画像を保存' });
  return true;
}
