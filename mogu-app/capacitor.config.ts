import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mogu.mobile',
  appName: 'MogU',
  webDir: 'dist',
  backgroundColor: '#FBF7F0',
  ios: {
    // 'always' だと、OS側の余白とCSSの env(safe-area-inset-*) が二重にかかり、
    // 画面の上下に余白ができる。余白はCSS側だけで管理するため 'never' にする。
    contentInset: 'never',
    backgroundColor: '#FBF7F0',
  },
  android: {
    backgroundColor: '#FBF7F0',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#FBF7F0',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FBF7F0',
    },
  },
};

export default config;
