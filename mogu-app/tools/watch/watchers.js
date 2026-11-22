// ページに入れる3つの監視役。アプリのコードは変えない
window.__WATCH = {
  errors: [],   // 監視役① エラー番
  taps: [],     // 監視役② ボタン番
  content: [],  // 監視役③ 中身番
};

// ---- 監視役① エラー番：落ちた・赤いエラーを全部ひろう ----
window.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG') {
    window.__WATCH.content.push({ kind: '写真が出ない', detail: e.target.getAttribute('src') || '(src なし)' });
    return;
  }
  window.__WATCH.errors.push({ kind: '落ちた', detail: String((e.error && e.error.stack) || e.message).slice(0, 300) });
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.__WATCH.errors.push({ kind: '待ちきれなかった', detail: String((r && (r.stack || r.message)) || r).slice(0, 300) });
});

const realError = console.error.bind(console);
console.error = (...a) => {
  const text = a.map((x) => (x && x.message) || String(x)).join(' ');
  // React の開発用の注意は、落ちるものだけ拾う
  window.__WATCH.errors.push({ kind: 'console.error', detail: text.slice(0, 300) });
  realError(...a);
};

// ---- 監視役③ 中身番：画面に出ている中身がおかしくないか ----
window.__WATCH.checkContent = (where) => {
  const found = [];
  const push = (kind, detail) => found.push({ where, kind, detail: String(detail).slice(0, 160) });

  // 写真の枠はあるのに、写真が入っていない
  document.querySelectorAll('img').forEach((img) => {
    const r = img.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (!img.getAttribute('src')) push('img に src がない', img.outerHTML.slice(0, 100));
    else if (img.complete && img.naturalWidth === 0) push('写真が読めなかった', img.getAttribute('src'));
  });

  // 文字に undefined / NaN / null / [object Object] が出ていないか
  const text = document.body.innerText || '';
  ['undefined', 'NaN', 'null', '[object Object]'].forEach((bad) => {
    if (text.includes(bad)) {
      const i = text.indexOf(bad);
      push('画面に「' + bad + '」が出ている', text.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' '));
    }
  });

  // 押せるのに名前が無いボタン（目の見えない人が使えない・押し間違いのもと）
  document.querySelectorAll('button').forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const label = (b.textContent || '').trim() || b.getAttribute('aria-label') || '';
    if (!label) push('名前のないボタン', b.outerHTML.slice(0, 100));
    // 指で押せる大きさ（iOS は 44x44 が目安）
    if (r.width < 32 || r.height < 32) push('小さすぎるボタン', (label || '(名前なし)') + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  });

  return found;
};

// ---- 監視役② ボタン番：押せるものを数え、押したあと画面が変わったか見る ----
window.__WATCH.listButtons = () => {
  const out = [];
  document.querySelectorAll('button, [role="button"], a[href]').forEach((b, i) => {
    const r = b.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (b.disabled) return;
    b.setAttribute('data-watch-id', String(i));
    const label = ((b.textContent || '').trim() || b.getAttribute('aria-label') || '(名前なし)').slice(0, 40);
    // アプリの外へ出るもの（ブラウザ・メール）と、いま開いているタブは
    // 「押しても画面が変わらない」のが正しいので、数えない
    const outside = /利用規約|プライバシー|ヘルプ|お問い合わせ|運営者|お店の情報|出典|ライセンス/.test(label)
      || b.tagName === 'A'
      || b.getAttribute('aria-current') === 'page'
      || b.getAttribute('aria-selected') === 'true'
      || b.getAttribute('aria-pressed') === 'true';
    out.push({ id: String(i), label, outside });
  });
  return out;
};

// 画面の様子。文字だけでなく、押した／選んだの状態も見る（切り替えボタンを見逃さない）
window.__WATCH.snapshot = () => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000);
  const state = [...document.querySelectorAll('[aria-pressed],[aria-checked],[aria-selected],input')]
    .map((e) => (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-checked') || '')
      + (e.getAttribute('aria-selected') || '') + (e.value ?? '')).join('|');
  return text + '##' + state + '##' + document.querySelectorAll('*').length;
};

window.__WATCH.tap = (id) => {
  const el = document.querySelector('[data-watch-id="' + id + '"]');
  if (!el) return false;
  el.click();
  return true;
};

window.__WATCH.reset = () => {
  window.__WATCH.errors = [];
  window.__WATCH.taps = [];
  window.__WATCH.content = [];
};
