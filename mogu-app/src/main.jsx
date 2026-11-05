import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 確定デザインの書体（引き渡し書 §3-2）。アプリに同梱し、通信がなくても表示できるようにする
import '@fontsource/dela-gothic-one/400.css'
import '@fontsource/ibm-plex-sans-jp/400.css'
import '@fontsource/ibm-plex-sans-jp/500.css'
import '@fontsource/ibm-plex-sans-jp/700.css'
import './index.css'
import './components/ui/ui.css'
import { applyTheme } from './theme/applyTheme'
import { applyTextZoom } from './lib/textZoom'
import App from './App.jsx'

applyTheme()
applyTextZoom()
// アプリに戻ってきたとき、iPhone の文字の大きさが変わっていれば合わせ直す
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') applyTextZoom()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
