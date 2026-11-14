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

// 画像ファイルの共有（③シェア画像など）。ファイルを共有できない端末では false
export const canShareFiles = (files) => canShare() && typeof navigator.canShare === 'function' && navigator.canShare({ files });
export async function shareFiles({ title, text, files }) {
  if (!canShareFiles(files)) return false;
  try {
    await navigator.share({ title, text, files });
    return true;
  } catch {
    return false;
  }
}
