import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mogu.mobile',
  appName: 'mogu',
  webDir: 'dist',
  backgroundColor: '#FFFFFF',
  ios: {
    // 'always' だと、OS側の余白とCSSの env(safe-area-inset-*) が二重にかかり、
    // 画面の上下に余白ができる。余白はCSS側だけで管理するため 'never' にする。
    contentInset: 'never',
    backgroundColor: '#FFFFFF',
  },
  android: {
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    // 起動画面はアプリの中の最初の画面（同じ見た目）に引き継ぎ、そこでハリーがのぞきこむ動きを出す（確定版 Final-12）
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
