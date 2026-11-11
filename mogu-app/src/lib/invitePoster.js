// グループ招待のQRポスター（画面ごとの仕様 ⑪「QRコードのポスターの見た目」）
//   確定版の見本は未確認のため、仕様の文章（moguロゴを繰り返した背景・斜めの「SCAN TO JOIN」の帯・
//   グループ名のシール・招待コード・メンバーの写真は出さない）どおりに組んだ暫定デザイン
import { LOGO, LOGO_RATIO } from './brand';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// qrText: 招待ページのURL（開けばアプリが開く・アプリがなければコードを案内する。§10）
export async function buildInvitePosterDataUrl({ qrText, groupName, code }) {
  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 640, color: { dark: '#2E2C2A', light: '#FBF7F0' } });
  const [logoImg, qrImg] = await Promise.all([loadImage(LOGO.black), loadImage(qrDataUrl)]);

  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 背景（クリーム）＋ moguロゴを薄く繰り返す
  ctx.fillStyle = '#FBF7F0';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.globalAlpha = 0.07;
  const lw = 200;
  const lh = lw * LOGO_RATIO;
  for (let y = -lh; y < size + lh; y += lh + 54) {
    for (let x = -lw; x < size + lw; x += lw + 54) {
      ctx.drawImage(logoImg, x, y, lw, lh);
    }
  }
  ctx.restore();

  // 斜めの帯「SCAN TO JOIN」
  ctx.save();
  ctx.translate(size / 2, 150);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.fillStyle = '#2E2C2A';
  ctx.fillRect(-size, -36, size * 2, 72);
  ctx.fillStyle = '#FBF7F0';
  ctx.font = '700 42px -apple-system, "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S C A N   T O   J O I N', 0, 4);
  ctx.restore();

  // 白いQRのカード
  const cardW = 640;
  const cardH = 640;
  const cardX = (size - cardW) / 2;
  const cardY = 290;
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2E2C2A';
  ctx.stroke();
  ctx.drawImage(qrImg, cardX + 40, cardY + 40, cardW - 80, cardH - 80);

  // グループ名のシール
  const name = groupName || '';
  ctx.font = '700 34px -apple-system, "Hiragino Kaku Gothic ProN", sans-serif';
  const padX = 28;
  const textW = ctx.measureText(name).width;
  const pillW = Math.min(size - 80, textW + padX * 2);
  const pillH = 64;
  const pillX = (size - pillW) / 2;
  const pillY = cardY + cardH + 36;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = '#2E2C2A';
  ctx.fill();
  ctx.fillStyle = '#FBF7F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, size / 2, pillY + pillH / 2 + 2, pillW - padX);

  // 招待コード
  ctx.font = '600 30px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#8B8177';
  ctx.fillText(code, size / 2, pillY + pillH + 46);

  return canvas.toDataURL('image/png');
}
