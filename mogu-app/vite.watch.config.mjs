// 点検用のビルド設定（3つの監視役で全ページを見るときだけ使う）
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function appVersion() {
  try {
    const pbx = readFileSync(new URL('./ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
    const m = pbx.match(/MARKETING_VERSION = ([^;]+);/);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  resolve: {
    alias: [
      // ログインの代わりに点検ユーザーで入る。ほかは本物のコードのまま
      { find: /^(.*)\/context\/AuthContext$/, replacement: new URL('./.verify/auth-watch.jsx', import.meta.url).pathname },
    ],
  },
  build: {
    outDir: '/home/claude/work/watch/dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
});
