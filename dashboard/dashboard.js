(() => {
  const { tl, int, signed, pct } = SCC.format;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  let analysis = null;

  const paintSummary = (l) =>
    l.parts ? `${l.parts.localPainted.length} / ${l.parts.painted.length}` : '?';
  const breakdownTitle = (r) =>
    [`Taban ${SCC.config.scoring.baseScore}`, ...r.breakdown.map((b) => `${b.label}: ${signed(b.points, 1)}`)].join('\n');

  function renderStats() {
    const best = analysis.model ? analysis.eligible[0] : null;
    const tiles = [
      ['Kayıtlı ilan', int(analysis.rows.length)],
      ['Kriterlere uygun', int(analysis.eligible.length)],
      ['Elenen', int(analysis.excluded.length)],
      ['En iyi fırsat', best ? pct(best.diffPct) : '–'],
    ];
    $('stats').innerHTML = tiles
      .map(([label, value]) => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div></div>`)
      .join('');
  }

  function renderFitText() {
    const { model, eligible } = analysis;
    const min = SCC.config.minListingsForFit;
    if (!model) {
      $('fit-text').textContent = `Beklenen fiyat çizgisi için en az ${min} uygun ilan gerekiyor (şu an ${eligible.length}).`;
      return;
    }
    const perPoint = tl(model.slope);
    let text = `Fiyat ≈ ${perPoint} × skor ${model.intercept < 0 ? '−' : '+'} ${tl(Math.abs(model.intercept))}  ·  R² ${model.r2.toFixed(2)}  ·  ${model.n} ilan`;
    if (model.slope <= 0) text += '  ·  Uyarı: skor arttıkça fiyat düşüyor, puan ağırlıkları gözden geçirilmeli.';
    $('fit-text').textContent = text;
    $('fit-text').classList.toggle('warn', model.slope <= 0);
  }

  function showTooltip(r, e) {
    const tip = $('tooltip');
    if (!r) {
      tip.hidden = true;
      return;
    }
    const lines = [
      ['Fiyat', tl(r.listing.price)],
      ['Skor', r.score],
      ['KM', int(r.listing.km)],
      ['Paket', r.trim || '–'],
    ];
    if (r.predicted != null) lines.push(['Beklenen', tl(r.predicted)], ['Fark', `${tl(r.diff)} (${pct(r.diffPct)})`]);
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
    $('legend').hidden = !analysis.model;
    SCC.drawScatter($('chart'), analysis.eligible, analysis.model, { onHover: showTooltip, onOpen: open });
  }

  function renderEligible() {
    const rows = analysis.eligible;
    const head = `<thead><tr>
      <th class="num">#</th><th>İlan</th><th class="num">Yıl</th><th>Paket</th><th>Vites</th><th class="num">KM</th>
      <th class="num" title="Lokal boya / boya">L / B</th><th class="num">Tramer</th><th class="num">Skor</th>
      <th class="num">Fiyat</th><th class="num">Beklenen</th><th class="num">Fark</th><th class="num">%</th><th></th>
    </tr></thead>`;
    const body = rows
      .map((r, i) => {
        const l = r.listing;
        const tone = r.diff == null ? '' : r.diff < 0 ? 'cheap' : 'dear';
        const arrow = r.diff == null ? '' : r.diff < 0 ? '▼ ' : '▲ ';
        return `<tr>
          <td class="num">${i + 1}</td>
          <td class="title"><a href="${esc(l.url)}" target="_blank">${esc(l.title || l.id)}</a></td>
          <td class="num">${l.year ?? '–'}</td>
          <td>${esc(r.trim || '–')}</td>
          <td>${esc(l.gear || '–')}</td>
          <td class="num">${int(l.km)}</td>
          <td class="num">${paintSummary(l)}</td>
          <td class="num">${l.tramer == null ? '?' : int(l.tramer)}</td>
          <td class="num" title="${esc(breakdownTitle(r))}">${r.score}</td>
          <td class="num">${tl(l.price)}</td>
          <td class="num">${r.predicted == null ? '–' : tl(r.predicted)}</td>
          <td class="num ${tone}">${r.diff == null ? '–' : arrow + tl(Math.abs(r.diff))}</td>
          <td class="num ${tone}">${pct(r.diffPct)}</td>
          <td><button data-del="${esc(l.id)}">Sil</button></td>
        </tr>`;
      })
      .join('');
    $('eligible').innerHTML = head + `<tbody>${body || '<tr><td colspan="14" class="empty">Henüz yok.</td></tr>'}</tbody>`;
  }

  function renderExcluded() {
    const head = `<thead><tr><th>İlan</th><th class="num">Yıl</th><th>Model</th><th class="num">Fiyat</th><th>Neden</th><th></th></tr></thead>`;
    const body = analysis.excluded
      .map((r) => {
        const l = r.listing;
        return `<tr>
          <td class="title"><a href="${esc(l.url)}" target="_blank">${esc(l.title || l.id)}</a></td>
          <td class="num">${l.year ?? '–'}</td>
          <td>${esc(l.model || '–')}</td>
          <td class="num">${tl(l.price)}</td>
          <td class="reasons">${r.reasons.map(esc).join('<br>')}</td>
          <td><button data-del="${esc(l.id)}">Sil</button></td>
        </tr>`;
      })
      .join('');
    $('excluded').innerHTML = head + `<tbody>${body || '<tr><td colspan="6" class="empty">Henüz yok.</td></tr>'}</tbody>`;
  }

  async function render() {
    analysis = SCC.analyze(await SCC.storage.list());
    renderStats();
    renderFitText();
    renderChart();
    renderEligible();
    renderExcluded();
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  }

  const today = () => new Date().toISOString().slice(0, 10);

  // Semicolon-separated with a BOM so Turkish Excel opens it with the right columns and characters.
  function exportCsv() {
    const cols = ['id', 'title', 'url', 'year', 'trim', 'gear', 'km', 'localPainted', 'painted', 'tramer', 'score', 'price', 'predicted', 'diff', 'diffPct', 'eligible', 'reasons'];
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [...analysis.eligible, ...analysis.excluded].map((r) => {
      const l = r.listing;
      return [
        l.id, l.title, l.url, l.year, r.trim, l.gear, l.km,
        l.parts?.localPainted.length, l.parts?.painted.length, l.tramer,
        r.score, l.price, r.predicted && Math.round(r.predicted), r.diff && Math.round(r.diff),
        r.diffPct && (r.diffPct * 100).toFixed(1), r.eligible ? 'evet' : 'hayır', r.reasons.join(' | '),
      ].map(cell).join(';');
    });
    download(`clio-${today()}.csv`, '﻿' + [cols.join(';'), ...lines].join('\n'), 'text/csv;charset=utf-8');
  }

  async function exportJson() {
    download(`clio-backup-${today()}.json`, JSON.stringify(await SCC.storage.all(), null, 2), 'application/json');
  }

  async function importJson(file) {
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('beklenen format: { id: ilan }');
      await SCC.storage.replaceAll({ ...(await SCC.storage.all()), ...incoming });
    } catch (err) {
      alert(`İçe aktarılamadı: ${err.message}`);
    }
  }

  document.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (id && confirm('Bu ilan silinsin mi?')) await SCC.storage.remove(id);
  });
  $('export-csv').onclick = exportCsv;
  $('export-json').onclick = exportJson;
  $('import-json').onchange = (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.listings) render();
  });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => analysis && renderChart(), 150);
  });

  render();
})();
