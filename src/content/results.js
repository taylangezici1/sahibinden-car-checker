var SCC = globalThis.SCC || (globalThis.SCC = {});

// Search results: a "Kaydet" button under each listing that saves it, and a small box
// with how many of the page's cars are saved and a way to the dashboard. Saving opens
// the listing in a background tab, where content.js reads and saves it, then the tab
// closes (saveViaTab in background.js). Buttons hang off the listing links rather
// than the results table markup, so they keep working if sahibinden changes the layout.
(() => {
  const { score } = SCC.format;
  const APP_NAME = chrome.runtime.getManifest().name;
  const LINK = SCC.CAR_CATEGORIES.map((c) => `a[href*="/ilan/vasita-${c}-"]`).join(', ');
  const idOf = (href) => href.match(/(\d{6,})(?:\/detay)?\/?(?:[?#].*)?$/)?.[1];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // Longer than background.js waits for a tab, in case its service worker restarted mid-way.
  const TAB_GUARD_MS = 45000;

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
    button { display: block; width: 100%; min-height: 46px; padding: 10px 14px; cursor: pointer; border-radius: 8px;
             font: inherit; font-size: 17px; font-weight: 600; }
    .primary { color: #fff; background: #1d5fb8; border: 0; }
    .primary:hover { filter: brightness(1.1); }
    .hide { width: auto; min-height: 0; padding: 2px 10px; font-size: 14px; font-weight: 400; color: #45443f; background: #fff; border: 1px solid #e3e2dc; }
    .box.min p, .box.min .acts { display: none; }
    .box.min header { margin: 0; }
  `;
  const VERDICT = { cheap: 'Ucuz', fair: 'Normal fiyat', dear: 'Pahalı' };

  // ---- Saving: each click opens its listing right away.

  const state = new Map(); // id -> 'saving' | { error }; saved ones are read from storage

  async function save(id, url) {
    if (SCC.staleNotice() || state.get(id) === 'saving') return;
    state.set(id, 'saving');
    paint();
    let status;
    try {
      ({ status } = await Promise.race([
        chrome.runtime.sendMessage({ type: 'saveViaTab', url }),
        sleep(TAB_GUARD_MS).then(() => ({ status: 'timeout' })),
      ]));
    } catch (err) {
      console.warn('[SCC] Kaydedilemedi:', url, err);
    }
    const errors = {
      botcheck: 'sahibinden doğrulama istedi. Öne gelen sekmede doğrulamayı tamamlayın.',
      gone: 'Bu ilan artık yayında değil.',
      closed: 'İlan sekmesi kapatıldı.',
      timeout: 'İlan sayfası zamanında açılmadı. İlanı açarak kaydedebilirsiniz.',
    };
    if (status === 'ok') state.delete(id);
    else state.set(id, { error: errors[status] || 'İlan sayfası okunamadı. İlanı açarak kaydedebilirsiniz.' });
    paint();
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
        // Result rows are clickable on sahibinden; this click must not open the listing here.
        e.preventDefault();
        e.stopPropagation();
        save(id, link.href);
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
      let look = ['', '☆ Kaydet', `${APP_NAME}: ilanı arka planda açıp kaydeder`];
      if (s === 'saving') look = ['busy', 'Kaydediliyor…', ''];
      else if (s?.error) look = ['error', '✗ Kaydedilemedi, tekrar deneyin', s.error];
      else if (row) {
        const verdict = row.eligible ? VERDICT[row.verdict] : 'Uygun değil';
        const drop = SCC.priceChange(row.listing)?.diff < 0 ? ' · ▼ Fiyatı düştü' : '';
        look = ['saved', `✓ Kayıtlı · ${score(row.score)} puan${verdict ? ` · ${verdict}` : ''}${drop}`, 'Bilgileri yenilemek için tıklayın'];
      }
      button.className = look[0];
      button.textContent = look[1];
      button.title = look[2];
    }
  }

  // ---- The box: how many of this page's cars are saved, and the way to compare them.

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
    const root = boxRoot();
    root.innerHTML = `<style>${BOX_STYLE}</style>
      <div class="box ${minimized ? 'min' : ''}" lang="tr">
        <header>${SCC.LOGO_SVG}<b>${esc(APP_NAME)}</b><button class="hide" data-act="min">${minimized ? 'Aç' : 'Küçült'}</button></header>
        <p>Bu sayfada ${total} ilan var${saved ? `, ${saved} tanesi kayıtlı` : ''}.</p>
        <div class="acts"><button class="primary" data-act="dash">Kaydedilen ilanları karşılaştır</button></div>
      </div>`;
    root.querySelector('[data-act="min"]').onclick = () => {
      minimized = !minimized;
      paint();
    };
    root.querySelector('[data-act="dash"]').onclick = () => {
      if (SCC.staleNotice()) return;
      chrome.runtime.sendMessage({ type: 'openDashboard', group: mainGroup(rows) });
    };
  }

  async function paint() {
    if (SCC.extensionGone()) return; // storage is out of reach; buttons show the reload note
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
