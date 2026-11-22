// 駅：一覧が出る → 押す → 決まる、を本物のDBで通しで確かめる
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const DIST = '/home/claude/work/watch/dist';
const PORT = 54332;
const WATCHERS = fs.readFileSync('/home/claude/work/watch/watchers.js', 'utf8');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.map': 'application/json' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

(async () => {
  const server = http.createServer((req, rq) => {
    let f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    rq.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rq);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(WATCHERS);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  const tap = (want) => page.evaluate((w) => {
    const norm = (x) => (x || '').replace(/\s+/g, '');
    const hit = [...document.querySelectorAll('button,[role="button"],a[href]')]
      .find((b) => norm(b.textContent).includes(norm(w)) || norm(b.getAttribute('aria-label')).includes(norm(w)));
    if (!hit) return false;
    hit.click();
    return true;
  }, want);

  const type = (v) => page.evaluate((val) => {
    const all = [...document.querySelectorAll('input')];
    const el = all.find((i) => (i.getAttribute('aria-label') || '') === '駅をさがす') || all[0];
    if (!el) return { ok: false, inputs: all.length };
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, inputs: all.length, label: el.getAttribute('aria-label'), value: el.value };
  }, v);

  // 登録 → 名前 → 駅の段へ
  log('① お店を登録するを開く:', await tap('お店を登録する'));
  await sleep(1200);
  await page.evaluate(() => {
    const el = document.querySelector('input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, 'テスト食堂'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(1400);
  log('② 新しく登録するを押す:', await tap('新しく登録する'));
  await sleep(1000);
  log('   いまの見出し:', (await page.evaluate(() => document.body.innerText)).split('\n').find((l) => l.includes('最寄')) || '(無い)');

  log('③ 駅を選ぶを開く:', await tap('駅を選ぶ'));
  await sleep(1400);

  // 何も打っていないときに一覧が出るか
  let rows = await page.evaluate(() => [...document.querySelectorAll('section button')]
    .map((b) => (b.textContent || '').trim()).filter((t) => /駅/.test(t) && t.length < 24));
  log('④ 何も打たないときの一覧:', rows.length, '件 →', rows.slice(0, 5).join('、'));

  // 「しぶ」で絞る
  log('   打ち込み先:', JSON.stringify(await type('しぶ')));
  await sleep(1200);
  rows = await page.evaluate(() => [...document.querySelectorAll('section button')]
    .map((b) => (b.textContent || '').trim()).filter((t) => /駅/.test(t) && t.length < 24));
  log('⑤「しぶ」で絞ると:', rows.length, '件 →', rows.join('、'));

  // 「渋谷」でも出るか（TestFlight で出なかった打ち方）
  log('   打ち込み先:', JSON.stringify(await type('渋谷')));
  await sleep(1200);
  rows = await page.evaluate(() => [...document.querySelectorAll('section button')]
    .map((b) => (b.textContent || '').trim()).filter((t) => /駅/.test(t) && t.length < 24));
  log('⑥「渋谷」で絞ると:', rows.length, '件 →', rows.join('、'));

  // 押して決まるか
  log('⑦ 渋谷駅を押す:', await tap('渋谷駅'));
  await sleep(1000);
  const picked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /駅$|駅を選ぶ/.test((x.textContent || '').trim()));
    return b ? (b.textContent || '').trim() : '(無い)';
  });
  const sheetGone = await page.evaluate(() => !document.body.innerText.includes('駅をさがす'));
  log('⑧ 選んだあとのボタン:', picked, '／シートが閉じた:', sheetGone);

  // 徒歩を入れて［次へ］が押せるか
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].pop();
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(600);
  const nextOk = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '次へ');
    return b ? !b.disabled : null;
  });
  log('⑨ 徒歩5分を入れたあと［次へ］:', nextOk === null ? '(ボタンが無い)' : nextOk ? '押せる' : '押せない');

  const errs = await page.evaluate(() => window.__WATCH.errors);
  log('⑩ JSエラー:', errs.length, errs.slice(0, 2).map((e) => e.detail.slice(0, 80)));

  await page.screenshot({ path: '/home/claude/work/watch/station_result.png' });
  await browser.close();
  server.close();
})();
