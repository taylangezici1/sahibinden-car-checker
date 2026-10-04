var SCC = globalThis.SCC || (globalThis.SCC = {});

// Search results: a "Hepsini kaydet" box that saves every car on the page in one go,
// plus a small button under each listing that saves just that one and shows its state.
// Saving fetches the listing page and runs the same parser as content.js, so nothing
// has to be opened. Buttons hang off the listing links rather than the results table
// markup, so they keep working if sahibinden changes the list layout.
(() => {
  const { score } = SCC.format;
  const APP_NAME = chrome.runtime.getManifest().name;
  const LINK = SCC.CAR_CATEGORIES.map((c) => `a[href*="/ilan/vasita-${c}-"]`).join(', ');
  const idOf = (href) => href.match(/(\d{6,})(?:\/detay)?\/?(?:[?#].*)?$/)?.[1];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const BUTTON_STYLE = `
    :host { all: initial; }
    button {
      margin-top: 4px; padding: 4px 10px; cursor: pointer; text-align: left;
      font: 600 14px/1.3 "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1d5fb8; background: #fff; border: 1px solid #1d5fb8; border-radius: 6px;
    }
    button:hover { background: #edf2f9; }
    .saved { color: #0b6b2e; background: #e8f5ec; border-color: #9bd3ad; }
    .busy { color: #45443f; background: #f4f4f1; border-color: #d6d4cc; cursor: progress; }
    .error { color: #b42318; background: #fdeeec; border-color: #f1a9a0; }
  `;
  const BOX_STYLE = `
    :host { all: initial; }
    .box {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; box-sizing: border-box;
      width: 340px; max-width: calc(100vw - 40px); padding: 14px;
      color: #141414; background: #fff; border: 1px solid rgba(0,0,0,.14); border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0,0,0,.22); font: 16px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    header svg { width: 32px; height: 32px; display: block; }
    header b { flex: 1; }
    p { margin: 0 0 10px; }
    .hint { margin: 8px 0 0; color: #45443f; font-size: 15px; }
    .bar + .hint { margin: 0 0 10px; }
    .ok { color: #0b6b2e; font-weight: 600; }
    .bad { color: #b42318; font-weight: 600; }
    .bar { height: 12px; margin: 0 0 12px; overflow: hidden; background: #f4f4f1; border: 1px solid #e3e2dc; border-radius: 999px; }
    .bar i { display: block; height: 100%; background: #1d5fb8; border-radius: 999px; transition: width .3s; }
    button { display: block; width: 100%; min-height: 46px; padding: 10px 14px; cursor: pointer; border-radius: 8px;
             font: inherit; font-size: 17px; font-weight: 600; }
    .primary { color: #fff; background: #1d5fb8; border: 0; }
    .primary:hover { filter: brightness(1.1); }
    .secondary { color: #141414; background: #fff; border: 1px solid #d6d4cc; }
    .secondary:hover { border-color: #1d5fb8; }
    .hide { width: auto; min-height: 0; padding: 2px 10px; font-size: 14px; font-weight: 400; color: #45443f; background: #fff; border: 1px solid #e3e2dc; }
    .box.min p, .box.min .bar, .box.min .acts { display: none; }
    .box.min header { margin: 0; }
  `;
  const VERDICT = { cheap: 'Ucuz', fair: 'Normal fiyat', dear: 'Pahalı' };

  // ---- Saving. sahibinden bans clients that fetch quickly, so every listing fetch,
  // from any sahibinden tab, takes one shared lock and waits until the shared
  // nextFetchAt (a random 10-20 s after the previous fetch, see config.fetching).
  // The first sign of a block stops all fetching for cooldownMinutes.

  const LOCK = 'oto-fiyat-rehberi-fetch';
  const pageLoadedAt = Date.now();
  const fetching = () => SCC.config.fetching;
  const randomDelay = () => {
    const { minDelaySeconds: min, maxDelaySeconds: max } = fetching();
    return (min + Math.random() * (max - min)) * 1000;
  };
  const clock = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  // A captcha or "unusual traffic" page instead of a listing.
  const BOT_CHECK = /captcha|turnstile|olağan ?dışı|robot olmadığ|güvenlik doğrulama/i;

  const state = new Map(); // id -> 'queued' | 'saving' | { error }; saved ones are read from storage
  const jobs = []; // [{ id, url, cancelled }] waiting their turn
  let current = null;
  let working = false;
  let errorStreak = 0;
  let batch = null; // the "Hepsini kaydet" run: { ids, done, failed, finished, stopped }
  let blockedUntil = 0; // mirrors storage fetchBlockedUntil, for painting

  function enqueue(id, url) {
    if (state.get(id) === 'queued' || state.get(id) === 'saving') return;
    state.set(id, 'queued');
    jobs.push({ id, url, cancelled: false });
    work();
  }

  async function work() {
    if (working) return;
    working = true;
    while (jobs.length) {
      current = jobs.shift();
      paint();
      const result = await fetchAndSave(current);
      if (result === 'cancelled') state.delete(current.id);
      if (batch?.ids.has(current.id) && result !== 'cancelled') {
        batch.done++;
        if (result !== 'ok') batch.failed++;
      }
      errorStreak = result === 'error' ? errorStreak + 1 : 0;
      if (result === 'blocked') stop('blocked');
      // Not a listing, or several failures in a row: something is off, stop rather than push on.
      else if (result === 'unreadable' || errorStreak >= 3) stop('unreadable');
      current = null;
      paint();
    }
    working = false;
    if (batch) batch.finished = true;
    paint();
  }

  function stop(reason) {
    for (const job of jobs.splice(0)) {
      job.cancelled = true;
      state.delete(job.id);
    }
    // A job still waiting for its turn is called off too; one already downloading finishes.
    if (current) current.cancelled = true;
    if (batch && !batch.finished && !batch.stopped) batch.stopped = reason;
  }

  // Resolves to { res } or { cancelled } or { blockedUntil }.
  function throttledFetch(job) {
    return navigator.locks.request(LOCK, async () => {
      const shared = await chrome.storage.local.get(['nextFetchAt', 'fetchBlockedUntil']);
      if (Date.now() < (shared.fetchBlockedUntil || 0)) return { blockedUntil: shared.fetchBlockedUntil };
      // Never right after this page's own load either.
      const earliest = Math.max(shared.nextFetchAt || 0, pageLoadedAt + fetching().minDelaySeconds * 1000);
      if (earliest > Date.now()) await sleep(earliest - Date.now());
      if (job.cancelled) return { cancelled: true };
      state.set(job.id, 'saving');
      paint();
      try {
        return { res: await fetch(job.url, { credentials: 'include' }) };
      } finally {
        await chrome.storage.local.set({ nextFetchAt: Date.now() + randomDelay() });
      }
    });
  }

  async function block(id) {
    const until = Date.now() + fetching().cooldownMinutes * 60 * 1000;
    await chrome.storage.local.set({ fetchBlockedUntil: until });
    state.set(id, { error: `sahibinden erişimi kısıtladı. Saat ${clock(until)} olunca tekrar deneyin.` });
    return 'blocked';
  }

  async function fetchAndSave(job) {
    const { id, url } = job;
    try {
      const got = await throttledFetch(job);
      if (got.cancelled) return 'cancelled';
      if (got.blockedUntil) {
        state.set(id, { error: `Güvenlik için kayıt şimdilik kapalı. Saat ${clock(got.blockedUntil)} olunca tekrar deneyin.` });
        return 'blocked';
      }
      const res = got.res;
      const leftListing = res.redirected && !new URL(res.url).pathname.startsWith('/ilan/');
      if (res.status === 403 || res.status === 429 || leftListing) return block(id);
      if (!res.ok) throw new Error(`sahibinden sayfayı vermedi (${res.status})`);
      const html = await res.text();
      const listing = SCC.parseListing(new DOMParser().parseFromString(html, 'text/html'), url);
      if (!listing && BOT_CHECK.test(html)) return block(id);
      if (!listing) {
        state.set(id, { error: 'İlan sayfası okunamadı. İlanı açarak kaydedebilirsiniz.' });
        return 'unreadable';
      }
      state.delete(id);
      await SCC.storage.upsert(listing);
      return 'ok';
    } catch (err) {
      console.warn('[SCC] Kaydedilemedi:', url, err);
      state.set(id, { error: `${err.message}. İlanı açarak da kaydedebilirsiniz.` });
      return 'error';
    }
  }

  // "yaklaşık 4 dakika" for n more listings at the average delay.
  function duration(n) {
    const { minDelaySeconds: min, maxDelaySeconds: max } = fetching();
    const minutes = Math.ceil((n * (min + max)) / 2 / 60);
    return minutes <= 1 ? 'yaklaşık 1 dakika' : `yaklaşık ${minutes} dakika`;
  }

  // ---- Buttons under each listing.

  const links = new Map(); // id -> listing url, one per result row

  function addButtons() {
    let added = 0;
    for (const link of document.querySelectorAll(LINK)) {
      const id = idOf(link.href);
      if (!id || !link.textContent.trim() || link.querySelector('img')) continue; // title links only
      const row = link.closest('tr, li, article') || link.parentElement;
      if (row.querySelector('[data-scc-save]')) continue;

      const host = document.createElement('span');
      host.dataset.sccSave = id;
      host.style.display = 'block';
      host.attachShadow({ mode: 'open' }).innerHTML = `<style>${BUTTON_STYLE}</style><button type="button"></button>`;
      host.shadowRoot.querySelector('button').addEventListener('click', (e) => {
        // Result rows are clickable on sahibinden; this click must not open the listing.
        e.preventDefault();
        e.stopPropagation();
        enqueue(id, link.href);
      });
      link.after(host);
      links.set(id, link.href);
      added++;
    }
    return added;
  }

  function paintButtons(rows) {
    for (const host of document.querySelectorAll('[data-scc-save]')) {
      const id = host.dataset.sccSave;
      const button = host.shadowRoot.querySelector('button');
      const s = state.get(id);
      const row = rows.get(id);
      let look = ['', '☆ Kaydet', `${APP_NAME}: ilanı açmadan kaydeder`];
      if (s === 'queued') look = ['busy', 'Sırada…', ''];
      else if (s === 'saving') look = ['busy', 'Kaydediliyor…', ''];
      else if (s?.error) look = ['error', '✗ Kaydedilemedi, tekrar deneyin', s.error];
      else if (row) {
        const verdict = row.eligible ? VERDICT[row.verdict] : 'Uygun değil';
        look = ['saved', `✓ Kayıtlı · ${score(row.score)} puan${verdict ? ` · ${verdict}` : ''}`, 'Bilgileri yenilemek için tıklayın'];
      }
      button.className = look[0];
      button.textContent = look[1];
      button.title = look[2];
    }
  }

  // ---- The "Hepsini kaydet" box.

  let box = null;
  let minimized = false;

  function boxRoot() {
    if (!box) {
      box = document.createElement('div');
      box.attachShadow({ mode: 'open' });
      document.body.appendChild(box);
    }
    return box.shadowRoot;
  }

  // The model most of this page's saved cars belong to, so the dashboard opens on it.
  function mainGroup(rows) {
    const counts = {};
    for (const id of links.keys()) {
      const r = rows.get(id);
      if (r) counts[SCC.groupKey(r.listing)] = (counts[SCC.groupKey(r.listing)] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  function paintBox(rows) {
    const total = links.size;
    const saved = [...links.keys()].filter((id) => rows.has(id)).length;
    const unsaved = total - saved;
    const blocked = Date.now() < blockedUntil;
    let body;
    if (batch && !batch.finished) {
      const n = batch.ids.size;
      body = `<p>Kaydediliyor: <b>${batch.done} / ${n}</b></p>
        <div class="bar" role="progressbar" aria-valuenow="${batch.done}" aria-valuemax="${n}"><i style="width: ${(batch.done / n) * 100}%"></i></div>
        <p class="hint">Engellenmemek için ilanlar yavaşça, tek tek kaydediliyor: ${duration(n - batch.done)} kaldı. Bu sayfayı kapatmayın.</p>
        <div class="acts"><button class="secondary" data-act="stop">Durdur</button></div>`;
    } else {
      const kept = batch ? batch.done - batch.failed : 0;
      const report = !batch
        ? ''
        : batch.stopped === 'blocked'
          ? `<p class="bad">sahibinden erişimi kısıtladı, kayıt durduruldu.</p>`
          : batch.stopped === 'unreadable'
            ? `<p class="bad">sahibinden beklenmedik bir sayfa gösterdi, güvenlik için kayıt durduruldu. ${kept} ilan kaydedildi.</p>`
            : batch.stopped
              ? `<p>Durduruldu. ${kept} ilan kaydedildi.</p>`
              : `<p class="ok">✓ ${kept} ilan kaydedildi.${batch.failed ? ` <span class="bad">${batch.failed} ilan kaydedilemedi.</span>` : ''}</p>`;
      let action;
      if (blocked) {
        action = `<p class="hint">Engellenmemek için toplu kayıt şimdilik kapalı. Saat <b>${clock(blockedUntil)}</b> olunca kendiliğinden açılır.</p>`;
      } else if (unsaved) {
        action = `<button class="primary" data-act="all">${saved ? `Kalan ${unsaved} ilanı kaydet` : `Sayfadaki ${unsaved} ilanın hepsini kaydet`}</button>
          <p class="hint">Engellenmemek için ilanlar yavaşça, tek tek kaydedilir: ${duration(unsaved)} sürer.</p>`;
      } else {
        action = `<button class="primary" data-act="dash">Kaydedilen ilanları karşılaştır</button>`;
      }
      body = `${report}
        <p>Bu sayfada ${total} ilan var${saved ? `, ${saved} tanesi kayıtlı` : ''}.</p>
        <div class="acts">${action}</div>`;
    }

    const root = boxRoot();
    root.innerHTML = `<style>${BOX_STYLE}</style>
      <div class="box ${minimized ? 'min' : ''}" lang="tr">
        <header>${SCC.LOGO_SVG}<b>${esc(APP_NAME)}</b><button class="hide" data-act="min">${minimized ? 'Aç' : 'Küçült'}</button></header>
        ${body}
      </div>`;
    root.querySelector('[data-act="min"]').onclick = () => {
      minimized = !minimized;
      paint();
    };
    root.querySelector('[data-act="all"]')?.addEventListener('click', () => {
      const ids = [...links.keys()].filter((id) => !rows.has(id) && state.get(id) !== 'queued' && state.get(id) !== 'saving');
      batch = { ids: new Set(ids), done: 0, failed: 0, finished: false, stopped: null };
      errorStreak = 0;
      for (const id of ids) enqueue(id, links.get(id));
    });
    root.querySelector('[data-act="stop"]')?.addEventListener('click', () => {
      stop('user');
      paint();
    });
    root.querySelector('[data-act="dash"]')?.addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'openDashboard', group: mainGroup(rows) }),
    );
  }

  let unblockTimer;
  async function paint() {
    await SCC.storage.loadSettings();
    blockedUntil = (await chrome.storage.local.get('fetchBlockedUntil')).fetchBlockedUntil || 0;
    // Bring the save-all button back by itself once the cooldown is over.
    clearTimeout(unblockTimer);
    if (blockedUntil > Date.now()) unblockTimer = setTimeout(paint, blockedUntil - Date.now() + 1000);
    const rows = new Map(SCC.analyze(await SCC.storage.list()).flatMap((g) => g.rows.map((r) => [r.listing.id, r])));
    paintButtons(rows);
    // Not on the home page, whose showcase also links to cars.
    if (links.size && location.pathname !== '/') paintBox(rows);
  }

  if (addButtons()) paint();
  // Results that arrive later (filters, paging without a reload) get buttons too.
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => addButtons() && paint(), 300);
  }).observe(document.body, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.listings || changes.settings || changes.fetchBlockedUntil)) paint();
  });
})();
