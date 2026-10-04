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

  // ---- Saving: one listing page at a time, with a pause, so it doesn't look like a bot.

  const state = new Map(); // id -> 'queued' | 'saving' | { error }; saved ones are read from storage
  const jobs = []; // [{ id, url }] waiting their turn
  let working = false;
  let failStreak = 0;
  let batch = null; // the "Hepsini kaydet" run: { ids, done, failed, finished, stopped }

  function enqueue(id, url) {
    if (state.get(id) === 'queued' || state.get(id) === 'saving') return;
    state.set(id, 'queued');
    jobs.push({ id, url });
    work();
  }

  async function work() {
    if (working) return;
    working = true;
    while (jobs.length) {
      const { id, url } = jobs.shift();
      state.set(id, 'saving');
      paint();
      const result = await fetchAndSave(id, url);
      if (batch?.ids.has(id)) {
        batch.done++;
        if (result !== 'ok') batch.failed++;
      }
      failStreak = result === 'ok' ? 0 : failStreak + 1;
      // A refusal, or several pages in a row that aren't listings (a bot check page),
      // means sahibinden wants us to slow down: stop instead of pushing on.
      if (result === 'blocked' || failStreak >= 3) stop('blocked');
      paint();
      if (jobs.length) await sleep(1000 + Math.random() * 1000);
    }
    working = false;
    if (batch) batch.finished = true;
    paint();
  }

  function stop(reason) {
    for (const { id } of jobs.splice(0)) state.delete(id);
    if (batch && !batch.finished) batch.stopped = reason;
  }

  async function fetchAndSave(id, url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 403 || res.status === 429) {
        state.set(id, { error: 'sahibinden şu an izin vermiyor. Birkaç dakika sonra tekrar deneyin.' });
        return 'blocked';
      }
      if (!res.ok) throw new Error(`sahibinden sayfayı vermedi (${res.status})`);
      const listing = SCC.parseListing(new DOMParser().parseFromString(await res.text(), 'text/html'), url);
      if (!listing) throw new Error('İlan sayfası okunamadı');
      state.delete(id);
      await SCC.storage.upsert(listing);
      return 'ok';
    } catch (err) {
      console.warn('[SCC] Kaydedilemedi:', url, err);
      state.set(id, { error: `${err.message}. İlanı açarak da kaydedebilirsiniz.` });
      return 'error';
    }
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
    let body;
    if (batch && !batch.finished) {
      const n = batch.ids.size;
      body = `<p>Kaydediliyor: <b>${batch.done} / ${n}</b></p>
        <div class="bar" role="progressbar" aria-valuenow="${batch.done}" aria-valuemax="${n}"><i style="width: ${(batch.done / n) * 100}%"></i></div>
        <div class="acts"><button class="secondary" data-act="stop">Durdur</button></div>`;
    } else {
      const report = !batch
        ? ''
        : batch.stopped === 'blocked'
          ? `<p class="bad">sahibinden şu an daha fazla ilana izin vermiyor, kayıt durduruldu. Birkaç dakika bekleyip tekrar deneyin.</p>`
          : batch.stopped
            ? `<p>Durduruldu. ${batch.done - batch.failed} ilan kaydedildi.</p>`
            : `<p class="ok">✓ ${batch.done - batch.failed} ilan kaydedildi.${batch.failed ? ` <span class="bad">${batch.failed} ilan kaydedilemedi.</span>` : ''}</p>`;
      const action = unsaved
        ? `<button class="primary" data-act="all">${saved ? `Kalan ${unsaved} ilanı kaydet` : `Sayfadaki ${unsaved} ilanın hepsini kaydet`}</button>`
        : `<button class="primary" data-act="dash">Kaydedilen ilanları karşılaştır</button>`;
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
      failStreak = 0;
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

  async function paint() {
    await SCC.storage.loadSettings();
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
    if (area === 'local' && (changes.listings || changes.settings)) paint();
  });
})();
