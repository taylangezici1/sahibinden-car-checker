(() => {
  const { tl, int, signed, percent, score, ago } = SCC.format;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // One analysis per "Marka Seri" (largest first); `group` is the one on screen, picked by the URL hash.
  let groups = [];
  let group = null;

  const selectedKey = () => decodeURIComponent(location.hash.slice(1));

  function paintText(parts) {
    if (!parts) return 'Belirtilmemiş';
    const bits = [
      [parts.localPainted.length, 'lokal'],
      [parts.painted.length, 'boyalı'],
      [parts.changed.length, 'değişen'],
    ].filter(([n]) => n > 0);
    return bits.length ? bits.map(([n, label]) => `${n} ${label}`).join(', ') : 'Yok';
  }
  const tramerText = (l) =>
    (l.tramer == null ? 'Bilinmiyor' : l.tramer === 0 ? 'Yok' : tl(l.tramer)) +
    (l.overrides?.tramer !== undefined ? '<small>elle girildi</small>' : '');
  const breakdownTitle = (r) =>
    [`Başlangıç ${group.config.scoring.baseScore}`, ...r.breakdown.map((b) => `${b.label}: ${signed(b.points, 1)}`)].join('\n');

  // Under a price: how it moved since the listing was first saved.
  function priceNote(l) {
    const c = SCC.priceChange(l);
    if (!c) return '';
    const down = c.diff < 0;
    return `<small class="${down ? 'drop' : 'rise'}" title="İlk kaydedildiğinde ${tl(c.from)} · değişiklik ${ago(c.at)}">${down ? '▼' : '▲'} ${tl(Math.abs(c.diff))}</small>`;
  }
  const dropped = (r) => SCC.priceChange(r.listing)?.diff < 0;
  let onlyDrops = false;

  const VERDICT_WORDS = { cheap: ['▼', 'ucuz'], fair: ['●', 'Normal fiyat'], dear: ['▲', 'pahalı'] };
  function verdictChip(r) {
    if (!r.verdict) return '–';
    const [icon, word] = VERDICT_WORDS[r.verdict];
    const text = r.verdict === 'fair' ? word : `${tl(Math.abs(r.diff))} ${word}`;
    return `<span class="chip ${r.verdict}">${icon} ${esc(text)}</span><small>${percent(r.diffPct)} fark</small>`;
  }

  function renderPicker() {
    $('group').innerHTML = groups.length
      ? groups.map((g) => `<option value="${esc(g.key)}">${esc(g.key)} (${g.rows.length} ilan)</option>`).join('')
      : '<option>Henüz ilan yok</option>';
    $('group').disabled = !groups.length;
    if (groups.length) $('group').value = group.key;
  }

  function renderStats() {
    const best = group.fit ? group.eligible[0] : null;
    const tiles = [
      ['Kayıtlı ilan', int(group.rows.length)],
      ['Özelliklere uyan', int(group.eligible.length)],
      ['Uymayan', int(group.excluded.length)],
      ['En iyi fırsat', best?.verdict === 'cheap' ? `${percent(best.diffPct)} ucuz` : '–', best?.verdict === 'cheap' ? 'good' : ''],
    ];
    $('stats').innerHTML = tiles
      .map(([label, value, tone = '']) => `<div class="tile"><div class="label">${label}</div><div class="value ${tone}">${value}</div></div>`)
      .join('');
  }

  function renderFitText() {
    const { fit, eligible } = group;
    const min = group.config.minListingsForFit;
    const el = $('fit-text');
    el.classList.toggle('warn', Boolean(fit && fit.slope <= 0));
    if (!fit) {
      el.textContent = `Beklenen fiyat çizgisi için bu modelden en az ${min} uygun ilan gerekiyor. Şu an ${eligible.length} var.`;
      el.title = '';
      return;
    }
    el.textContent =
      fit.slope > 0
        ? `${fit.n} ilana göre hesaplandı.`
        : `Dikkat: bu modelde puan arttıkça fiyat düşüyor, değerlendirmeler güvenilir olmayabilir (${fit.n} ilan).`;
    el.title = `Fiyat ≈ ${tl(fit.slope)} × puan ${fit.intercept < 0 ? '−' : '+'} ${tl(Math.abs(fit.intercept))} · R² ${fit.r2.toFixed(2)}`;
  }

  function showTooltip(r, e) {
    const tip = $('tooltip');
    if (!r) {
      tip.hidden = true;
      return;
    }
    const lines = [
      ['Fiyat', tl(r.listing.price)],
      ['Kalite puanı', score(r.score)],
      ['Kilometre', int(r.listing.km)],
      ['Paket', r.trim || r.listing.model || '–'],
    ];
    if (r.predicted != null) {
      lines.push(['Beklenen fiyat', tl(r.predicted)]);
      lines.push(['Sonuç', r.verdict === 'fair' ? 'Normal fiyat' : `${tl(Math.abs(r.diff))} ${r.verdict === 'cheap' ? 'ucuz' : 'pahalı'}`]);
    }
    tip.innerHTML =
      `<b>${esc(r.listing.title || r.listing.id)}</b>` +
      lines.map(([k, v]) => `<div><span>${k}</span><span>${esc(v)}</span></div>`).join('');
    tip.hidden = false;
    const pad = 14;
    const { width, height } = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX + pad, innerWidth - width - 8)}px`;
    tip.style.top = `${Math.min(e.clientY + pad, innerHeight - height - 8)}px`;
  }

  const open = (r) => window.open(r.listing.url, '_blank');

  function renderChart() {
    $('legend').hidden = !group.fit;
    SCC.drawScatter($('chart'), group.eligible, group.fit, { onHover: showTooltip, onOpen: open });
  }

  // ---- Paging for both tables. The page size is this browser's preference; each
  // table keeps its own page, which goes back to 1 when another model is picked.
  const PAGE_SIZES = [10, 25, 50, 100];
  const pages = { eligible: 1, excluded: 1, gone: 1 };
  let pageSize = 25;
  try {
    const saved = Number(localStorage.getItem('pageSize'));
    if (PAGE_SIZES.includes(saved)) pageSize = saved;
  } catch {}

  // The rows of `list` on `which` table's current page (clamped, e.g. after a delete).
  function pageOf(which, list) {
    const count = Math.max(1, Math.ceil(list.length / pageSize));
    pages[which] = Math.min(Math.max(1, pages[which]), count);
    const start = (pages[which] - 1) * pageSize;
    return { rows: list.slice(start, start + pageSize), start, count };
  }

  function renderPager(which, total, count) {
    const el = $(`${which}-pager`);
    el.hidden = total <= PAGE_SIZES[0];
    if (el.hidden) return;
    const page = pages[which];
    const nav =
      count > 1
        ? `<button data-page="-1" ${page === 1 ? 'disabled' : ''}>‹ Önceki</button>
           <span>Sayfa <b>${page}</b> / ${count}</span>
           <button data-page="1" ${page === count ? 'disabled' : ''}>Sonraki ›</button>`
        : '';
    el.innerHTML = `${nav}<span class="total">${int(total)} ilan</span>
      <label class="size">Sayfa başına
        <select data-page-size>${PAGE_SIZES.map((n) => `<option ${n === pageSize ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>`;
  }

  // ---- Sorting "En iyi fırsatlar" by a column. Sonuç is the analysis order (best deal
  // first); the others start the way a buyer reads them (newest, least km, best score,
  // cheapest) and turn around on a second click. Ties keep the Sonuç order, and rows
  // without the value go last either way.
  const SORTS = {
    result: { label: 'Sonuç', value: (r) => r.diffPct, text: ['En ucuzdan en pahalıya', 'En pahalıdan en ucuza'] },
    year: { label: 'Yıl', value: (r) => r.listing.year, desc: true, text: ['Yıla göre, eskiden yeniye', 'Yıla göre, yeniden eskiye'] },
    trim: { label: 'Paket', value: (r) => r.trim || r.listing.model || null, words: true, text: ["Pakete göre, A'dan Z'ye", "Pakete göre, Z'den A'ya"] },
    km: { label: 'Kilometre', value: (r) => r.listing.km, text: ['Kilometreye göre, azdan çoğa', 'Kilometreye göre, çoktan aza'] },
    score: { label: 'Puan', value: (r) => r.score, desc: true, text: ['Puana göre, düşükten yükseğe', 'Puana göre, yüksekten düşüğe'] },
    price: { label: 'Fiyat', value: (r) => r.listing.price, text: ['Fiyata göre, düşükten yükseğe', 'Fiyata göre, yüksekten düşüğe'] },
  };
  let sort = { by: 'result', desc: false };

  function sorted(list) {
    const { value, words } = SORTS[sort.by];
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x == null || y == null) return (x == null) - (y == null);
      return dir * (words ? x.localeCompare(y, 'tr', { numeric: true }) : x - y);
    });
  }

  function sortHeader(by, cls) {
    const on = sort.by === by;
    const { label } = SORTS[by];
    const arrow = on ? (sort.desc ? '↓' : '↑') : '↕';
    const title = on ? 'Sırayı ters çevir' : `${label} sütununa göre sırala`;
    return `<th${cls ? ` class="${cls}"` : ''}${on ? ` aria-sort="${sort.desc ? 'descending' : 'ascending'}"` : ''}>
      <button class="sort${on ? ' on' : ''}" data-sort="${by}" title="${title}">${label}<span class="arrow" aria-hidden="true">${arrow}</span></button></th>`;
  }

  function renderEligible() {
    const head = `<thead><tr>
      <th class="num">Sıra</th><th>İlan</th>${sortHeader('year', 'num')}${sortHeader('trim')}<th>Vites</th>${sortHeader('km', 'num')}
      <th>Boya</th><th class="num">Tramer</th>${sortHeader('score', 'num')}
      ${sortHeader('price', 'num')}${sortHeader('result')}<th></th>
    </tr></thead>`;
    $('sort-text').textContent = `${SORTS[sort.by].text[sort.desc ? 1 : 0]} sıralı.`;
    const drops = group.eligible.filter(dropped);
    $('drops-count').textContent = `(${drops.length})`;
    const list = sorted(onlyDrops ? drops : group.eligible);
    const { rows, count } = pageOf('eligible', list);
    const body = rows
      .map((r) => {
        const l = r.listing;
        // The place in the full ranking, also when sorted by another column or only price drops are shown.
        const rank = group.eligible.indexOf(r) + 1;
        // The order only means something once there is a price line.
        const podium = group.fit && rank <= 3;
        return `<tr data-anchor="e-${esc(l.id)}"${podium ? ' class="podium"' : ''}>
          <td class="num">${podium ? `<span class="medal">${rank}</span>` : rank}</td>
          <td class="title"><a href="${esc(l.url)}" target="_blank">${esc(l.title || l.id)}</a></td>
          <td class="num">${l.year ?? '–'}</td>
          <td class="text">${esc(r.trim || l.model || '–')}</td>
          <td class="text">${esc(l.gear || '–')}</td>
          <td class="num">${int(l.km)}</td>
          <td class="text">${paintText(l.parts)}</td>
          <td class="num">${tramerText(l)}</td>
          <td class="num score" title="${esc(breakdownTitle(r))}">${score(r.score)}</td>
          <td class="num">${tl(l.price)}${priceNote(l)}</td>
          <td>${verdictChip(r)}</td>
          <td><button data-del="${esc(l.id)}">Sil</button></td>
        </tr>`;
      })
      .join('');
    const empty = onlyDrops ? 'Fiyatı düşen ilan yok.' : 'Henüz yok.';
    $('eligible').innerHTML = head + `<tbody>${body || `<tr><td colspan="12" class="empty">${empty}</td></tr>`}</tbody>`;
    renderPager('eligible', list.length, count);
  }

  function renderExcluded() {
    $('excluded-count').textContent = `(${group.excluded.length})`;
    const head = `<thead><tr><th>İlan</th><th class="num">Yıl</th><th>Model</th><th class="num">Fiyat</th><th>Neden uymuyor</th><th></th></tr></thead>`;
    const { rows, count } = pageOf('excluded', group.excluded);
    const body = rows
      .map((r) => {
        const l = r.listing;
        return `<tr data-anchor="x-${esc(l.id)}">
          <td class="title"><a href="${esc(l.url)}" target="_blank">${esc(l.title || l.id)}</a></td>
          <td class="num">${l.year ?? '–'}</td>
          <td class="text">${esc(l.model || '–')}</td>
          <td class="num">${tl(l.price)}</td>
          <td class="reasons">${r.reasons.map(esc).join('<br>')}</td>
          <td><button data-del="${esc(l.id)}">Sil</button></td>
        </tr>`;
      })
      .join('');
    $('excluded').innerHTML = head + `<tbody>${body || '<tr><td colspan="6" class="empty">Yok.</td></tr>'}</tbody>`;
    renderPager('excluded', group.excluded.length, count);
  }

  // Sold or taken down: out of the comparison, kept for their last asking price.
  function renderGone() {
    $('gone-count').textContent = `(${group.gone.length})`;
    const head = `<thead><tr><th>İlan</th><th class="num">Yıl</th><th>Paket / Model</th><th class="num">Kilometre</th>
      <th class="num">Puan</th><th class="num">Son fiyat</th><th>Kalktığı tarih</th><th></th></tr></thead>`;
    const { rows, count } = pageOf('gone', group.gone);
    const body = rows
      .map((r) => {
        const l = r.listing;
        return `<tr data-anchor="g-${esc(l.id)}">
          <td class="title"><a href="${esc(l.url)}" target="_blank">${esc(l.title || l.id)}</a></td>
          <td class="num">${l.year ?? '–'}</td>
          <td class="text">${esc(r.trim || l.model || '–')}</td>
          <td class="num">${int(l.km)}</td>
          <td class="num">${score(r.score)}</td>
          <td class="num">${tl(l.price)}${priceNote(l)}</td>
          <td>${new Date(l.goneAt).toLocaleDateString('tr-TR')}<small>${ago(l.goneAt)}</small></td>
          <td><button data-del="${esc(l.id)}">Sil</button></td>
        </tr>`;
      })
      .join('');
    $('gone').innerHTML = head + `<tbody>${body || '<tr><td colspan="8" class="empty">Yok.</td></tr>'}</tbody>`;
    renderPager('gone', group.gone.length, count);
  }

  function renderGroup() {
    group = groups.find((g) => g.key === selectedKey()) || groups[0] || SCC.analyzeGroup('', []);
    renderPicker();
    renderStats();
    renderFitText();
    renderChart();
    renderEligible();
    renderExcluded();
    renderGone();
    renderModelSettings();
    renderDeleteButtons();
  }

  function renderModelSettings() {
    $('model-panel').hidden = !group.key;
    if (!group.key) return;
    $('model-name').textContent = group.key;
    SCC.modelForm.show($('model-form'), $('model-status'), group);
  }

  // ---- Deleting: this model's listings or all of them, taken-down ones included.
  const groupSize = (g) => g.rows.length + g.gone.length;

  function renderDeleteButtons() {
    const all = groups.reduce((n, g) => n + groupSize(g), 0);
    $('delete-model').hidden = !group.key;
    $('delete-model').textContent = `${group.key} ilanlarını sil (${int(groupSize(group))})`;
    $('delete-all').textContent = `Bütün ilanları sil (${int(all)})`;
    $('delete-model').disabled = !groupSize(group);
    $('delete-all').disabled = !all;
  }

  async function deleteListings(key) {
    const count = key ? groupSize(group) : groups.reduce((n, g) => n + groupSize(g), 0);
    const what = key ? `${key} için kayıtlı ${int(count)} ilan` : `Bütün modellerde kayıtlı ${int(count)} ilan`;
    if (!count || !confirm(`${what} silinecek (yayından kalkanlar dahil).\n\nSilmeden önce bütün ilanların yedeği bilgisayarınıza indirilecek. Devam edilsin mi?`)) return;
    await exportJson(); // a way back if this was a mistake
    await SCC.storage.removeGroup(key);
  }

  // ---- A listing opened from here turned out to be taken down: its tab closed on its
  // own (src/content/leave.js), so this page says what happened.
  const TOAST_MS = 10000;
  let toastTimer;

  // `change` is chrome.storage's { oldValue, newValue } of `listings`.
  function toastGone({ oldValue = {}, newValue = {} }) {
    const gone = Object.values(newValue).filter((l) => l.goneAt && oldValue[l.id] && !oldValue[l.id].goneAt);
    if (!gone.length) return;
    const toast = $('toast');
    const one = gone.length === 1;
    toast.innerHTML = `
      <p>${one ? `<b>Bu ilan yayından kalkmış:</b> ${esc(gone[0].title || gone[0].id)}` : `<b>${gone.length} ilan yayından kalkmış.</b>`}<br>
        "Yayından kalkan ilanlar" bölümüne ${one ? 'taşındı' : 'taşındılar'}.</p>
      <div class="acts"><button data-act="show">Göster</button><button data-act="close">Kapat</button></div>`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), TOAST_MS);
    toast.querySelector('[data-act="show"]').onclick = () => {
      toast.hidden = true;
      showGone(gone[0]);
    };
    toast.querySelector('[data-act="close"]').onclick = () => (toast.hidden = true);
  }

  // Opens "Yayından kalkan ilanlar" on the listing's model and brings its row into view.
  async function showGone(listing) {
    const key = SCC.groupKey(listing);
    if (group?.key !== key) {
      const switched = new Promise((r) => addEventListener('hashchange', r, { once: true }));
      location.hash = encodeURIComponent(key);
      await switched;
    }
    const section = document.querySelector('section[data-anchor="gone"]');
    section.querySelector('details').open = true;
    const row = document.querySelector(`tr[data-anchor="g-${CSS.escape(listing.id)}"]`);
    (row || section).scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.classList.add('flash');
  }

  // The tables are rebuilt from scratch, so the browser can't keep the reader's
  // place by itself. Note the first row (else section) at the top of the screen
  // and put it back at the same height after the redraw.
  function keepingPlace(redraw) {
    if (scrollY === 0) return redraw();
    const visible = (el) => {
      const box = el.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    };
    const marks = [...document.querySelectorAll('tr[data-anchor]'), ...document.querySelectorAll('section[data-anchor]')]
      .filter(visible)
      .map((el) => [el.dataset.anchor, el.getBoundingClientRect().top]);
    redraw();
    for (const [key, top] of marks) {
      const el = document.querySelector(`[data-anchor="${CSS.escape(key)}"]`);
      if (el) return scrollBy(0, el.getBoundingClientRect().top - top);
    }
  }

  // Opening a saved listing only bumps its lastSeenAt; nothing on this page changes then.
  let shown = '';
  async function render() {
    const settings = await SCC.storage.loadSettings();
    const listings = await SCC.storage.list();
    const snapshot = JSON.stringify([settings, listings], (k, v) => (k === 'lastSeenAt' ? undefined : v));
    if (snapshot === shown) return;
    shown = snapshot;
    groups = SCC.analyze(listings);
    keepingPlace(renderGroup);
  }

  // Opens the model's settings and the score settings below them.
  function openSettings() {
    $('model-box').open = true;
    $('settings-box').open = true;
    const first = $('model-panel').hidden ? $('settings-panel') : $('model-panel');
    first.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const slug = (s) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '') || 'ilanlar';

  // Exports the model on screen. Semicolon-separated with a BOM so Turkish Excel
  // opens it with the right columns and characters.
  function exportCsv() {
    const cols = ['id', 'title', 'url', 'year', 'model', 'trim', 'gear', 'km', 'localPainted', 'painted', 'tramer', 'score', 'price', 'predicted', 'diff', 'diffPct', 'verdict', 'eligible', 'reasons'];
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [...group.eligible, ...group.excluded].map((r) => {
      const l = r.listing;
      return [
        l.id, l.title, l.url, l.year, l.model, r.trim, l.gear, l.km,
        l.parts?.localPainted.length, l.parts?.painted.length, l.tramer,
        r.score, l.price, r.predicted && Math.round(r.predicted), r.diff && Math.round(r.diff),
        r.diffPct && (r.diffPct * 100).toFixed(1), r.verdict, r.eligible ? 'evet' : 'hayır', r.reasons.join(' | '),
      ].map(cell).join(';');
    });
    download(`${slug(group.key)}-${today()}.csv`, '﻿' + [cols.join(';'), ...lines].join('\n'), 'text/csv;charset=utf-8');
  }

  async function exportJson() {
    download(`oto-fiyat-rehberi-yedek-${today()}.json`, JSON.stringify(await SCC.storage.all(), null, 2), 'application/json');
  }

  async function importJson(file) {
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('beklenen format: { id: ilan }');
      await SCC.storage.replaceAll({ ...(await SCC.storage.all()), ...incoming });
    } catch (err) {
      alert(`Yedek yüklenemedi: ${err.message}`);
    }
  }

  const name = chrome.runtime.getManifest().name;
  document.title = name;
  $('name').textContent = name;

  document.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (id && confirm('Bu ilan listeden silinsin mi?')) await SCC.storage.remove(id);
  });

  const renderTable = { eligible: renderEligible, excluded: renderExcluded, gone: renderGone };
  const firstPages = () => Object.keys(pages).forEach((k) => (pages[k] = 1));
  for (const which of Object.keys(pages)) {
    const pager = $(`${which}-pager`);
    pager.addEventListener('click', (e) => {
      const step = Number(e.target.closest('[data-page]')?.dataset.page);
      if (!step) return;
      pages[which] += step;
      renderTable[which]();
      // The new page starts at the top of the table: bring that into view.
      const section = pager.closest('section');
      if (section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: 'start' });
    });
    pager.addEventListener('change', (e) => {
      if (!e.target.matches('[data-page-size]')) return;
      pageSize = Number(e.target.value);
      try {
        localStorage.setItem('pageSize', String(pageSize));
      } catch {}
      firstPages();
      Object.values(renderTable).forEach((render) => render());
    });
  }
  $('eligible').addEventListener('click', (e) => {
    const by = e.target.closest('[data-sort]')?.dataset.sort;
    if (!by) return;
    sort = by === sort.by ? { by, desc: !sort.desc } : { by, desc: Boolean(SORTS[by].desc) };
    pages.eligible = 1;
    renderEligible();
    // The header was redrawn: keep the keyboard on the same column (detail is 0 for a key press).
    if (!e.detail) $('eligible').querySelector(`[data-sort="${by}"]`).focus();
  });
  $('only-drops').onchange = (e) => {
    onlyDrops = e.target.checked;
    pages.eligible = 1;
    renderEligible();
  };
  $('group').onchange = (e) => {
    location.hash = encodeURIComponent(e.target.value);
  };
  addEventListener('hashchange', () => {
    firstPages();
    renderGroup();
  });
  $('export-csv').onclick = exportCsv;
  $('export-json').onclick = exportJson;
  $('delete-model').onclick = () => deleteListings(group.key);
  $('delete-all').onclick = () => deleteListings(null);
  $('import-json').onchange = (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  };

  $('open-settings').onclick = openSettings;
  $('settings-reset').onclick = () => SCC.settingsForm.reset($('settings-form'), $('settings-status'));
  $('model-reset').onclick = () => SCC.modelForm.reset($('model-form'), $('model-status'), group);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.listings) toastGone(changes.listings);
    if (changes.listings || changes.settings) render();
  });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => group && renderChart(), 150);
  });

  // The settings form is built once; later renders only redraw the analysis.
  render().then(() => {
    $('base-score').textContent = SCC.defaultConfig.scoring.baseScore;
    SCC.settingsForm.mount($('settings-form'), $('settings-status'));
  });
})();
