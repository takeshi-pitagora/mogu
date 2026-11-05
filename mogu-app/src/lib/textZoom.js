// 文字の大きさ（引き渡し書 §5・実装計画 4章 #13）
//   iPhone の設定（画面表示と明るさ → テキストサイズ）の大きさを読み取って、画面の文字を大きくする。
//   下のタブと、大きな見出し（Dela 24pt 以上）は大きくしない（.no-zoom）。
//   形が崩れないよう、いちばん大きくても 1.5 倍まで（実機で確かめて調整する）
import { Capacitor } from '@capacitor/core';
import { TextZoom } from '@capacitor/text-zoom';

const MAX_ZOOM = 1.5;

export async function applyTextZoom() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { value } = await TextZoom.getPreferred();
    const zoom = Math.max(1, Math.min(MAX_ZOOM, Number(value) || 1));
    await TextZoom.set({ value: zoom });
  } catch {
    /* 読み取れないときは今の大きさのまま */
  }
}
