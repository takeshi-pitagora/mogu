// 3つの監視役で、アプリの画面をひととおり見てまわる
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const DIST = '/home/claude/work/watch/dist';
const PORT = 54331;
const WATCHERS = fs.readFileSync('/home/claude/work/watch/watchers.js', 'utf8');

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.map': 'application/json' };

function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rq) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(DIST, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      rq.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
  });
}

// 見てまわる順番。name は報告に出す画面の名前、go はそこへ行くための手順
const ROUTES = [
  { name: 'ホーム（山札）', go: [] },
  { name: 'グループ（一覧）', go: [{ tap: 'グループ' }] },
  { name: 'グループ（詳細・ボード）', go: [{ tap: 'グループ' }, { tapFirst: ['点検グループ'] }] },
  { name: '保存', go: [{ tap: '保存' }] },
  { name: 'プロフィール', go: [{ tap: 'プロフィール' }] },
  { name: '設定', go: [{ tap: 'プロフィール' }, { tap: '設定' }] },
  { name: 'お知らせ', go: [{ tap: 'プロフィール' }, { tap: 'お知らせ' }] },
  { name: 'お店を登録する（名前）', go: [{ tap: 'お店を登録' }] },
  { name: '手帳（ノート）', go: [{ tap: 'プロフィール' }, { tap: '手帳' }] },
  { name: 'スタンプ帳', go: [{ tap: 'プロフィール' }, { tap: 'スタンプ帳' }] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=393,852'],
  });

  const report = [];

  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(WATCHERS);
    const netFails = [];
    page.on('requestfailed', (r) => netFails.push(r.url().slice(0, 120)));
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(1200);

    // その画面まで行く
    let reached = true;
    for (const step of route.go) {
      const ok = await page.evaluate((s) => {
        const norm = (x) => (x || '').replace(/\s+/g, '');
        const all = [...document.querySelectorAll('button, [role="button"], a[href]')];
        const want = s.tap || (s.tapFirst && s.tapFirst[0]) || s.text;
        const hit = all.find((b) => norm(b.textContent).includes(norm(want)) || norm(b.getAttribute('aria-label')).includes(norm(want)));
        if (!hit) return false;
        hit.click();
        return true;
      }, step).catch(() => false);
      if (!ok) { reached = false; break; }
      await sleep(900);
    }

    const r = { name: route.name, reached, errors: [], content: [], deadButtons: [], buttons: 0, netFails: [] };

    if (reached) {
      // 監視役③ 中身番
      r.content = await page.evaluate((w) => window.__WATCH.checkContent(w), route.name);

      // 監視役② ボタン番：押してみて、画面が変わるか
      const list = await page.evaluate(() => window.__WATCH.listButtons());
      r.buttons = list.length;
      const SKIP = /ログアウト|削除|退会|やめる|抜ける|通報|送る|登録する|保存|購入|変更する|消す|ブロック/;
      for (const b of list) {
        if (SKIP.test(b.label) || b.outside) continue;
        const before = await page.evaluate(() => window.__WATCH.snapshot());
        const tapped = await page.evaluate((id) => window.__WATCH.tap(id), b.id);
        if (!tapped) continue;
        await sleep(650);
        const after = await page.evaluate(() => window.__WATCH.snapshot());
        if (before === after) r.deadButtons.push(b.label);
        // 元の画面に戻す
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await sleep(700);
        for (const step of route.go) {
          await page.evaluate((s) => {
            const norm = (x) => (x || '').replace(/\s+/g, '');
            const want = s.tap || (s.tapFirst && s.tapFirst[0]) || s.text;
            const hit = [...document.querySelectorAll('button, [role="button"], a[href]')]
              .find((x) => norm(x.textContent).includes(norm(want)) || norm(x.getAttribute('aria-label')).includes(norm(want)));
            if (hit) hit.click();
          }, step).catch(() => {});
          await sleep(650);
        }
        await page.evaluate(() => window.__WATCH.listButtons());
      }
    }

    // 監視役① エラー番
    r.errors = await page.evaluate(() => window.__WATCH.errors).catch(() => []);
    r.content = (r.content || []).concat(await page.evaluate(() => window.__WATCH.content).catch(() => []));
    r.netFails = [...new Set(netFails)].slice(0, 6);

    await page.screenshot({ path: `/home/claude/work/watch/shot_${report.length + 1}.png` }).catch(() => {});
    report.push(r);
    await page.close();
    console.log(`[${route.name}] 着いた=${reached} ボタン=${r.buttons} 反応なし=${r.deadButtons.length} エラー=${r.errors.length} 中身=${r.content.length}`);
  }

  fs.writeFileSync('/home/claude/work/watch/report.json', JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
})();
