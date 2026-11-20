import { createRoot } from 'react-dom/client';
import { act } from 'react';
import HarryCorner from '/home/claude/mogu/mogu-app/src/pages/shop/profile/HarryCorner.jsx';
import VisitSheet from '/home/claude/mogu/mogu-app/src/pages/shop/visit/VisitSheet.jsx';
import AddSheet from '/home/claude/mogu/mogu-app/src/pages/shop/add/AddSheet.jsx';
import { ToastProvider } from '/home/claude/mogu/mogu-app/src/components/ui/Toast.jsx';

const noop = () => {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shop = { id: 's1', name: 'サンプル食堂 渋谷店' };

const screens = [
  ['1 入口：ハリーと［＋ 足す］', <HarryCorner onAsk={noop} onAdd={noop} />],
  ['4 アンケート', <VisitSheet shop={shop} onClose={noop} onDone={noop} />],
  ['13 ［＋ 足す］の一覧', <AddSheet shop={shop} onClose={noop} onAdded={noop} />],
];

async function run() {
  const i = Number(location.hash.replace('#', '') || 0);
  const mount = document.getElementById('row');
  const root = createRoot(mount);
  await act(async () => { root.render(<ToastProvider>{screens[i][1]}</ToastProvider>); });
  await act(async () => { await sleep(120); });
  window.__ready = true;
}
run().catch((e) => {
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#900;font-size:14px;white-space:pre-wrap">${e && e.stack ? e.stack : e}</pre>`);
  window.__ready = true;
});
