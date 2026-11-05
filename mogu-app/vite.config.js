import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 設定の「Version 1.2」に出すため、iOS のプロジェクトの MARKETING_VERSION を読み込む（App Store と同じ番号）
function appVersion() {
  try {
    const pbx = readFileSync(new URL('./ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8')
    const m = pbx.match(/MARKETING_VERSION = ([^;]+);/)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    watch: {
      usePolling: true, // WSL環境でファイルの変更を確実に検知させる設定
    },
  },
})
