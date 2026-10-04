var SCC = globalThis.SCC || (globalThis.SCC = {});

(() => {
  const { tl, int, signed, pct } = SCC.format;

  const STYLE = `
    :host { all: initial; }
    .card {
      --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
      --line: #e1e0d9; --good: #006300; --bad: #d03b3b;
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      width: 300px; max-height: 80vh; overflow: auto;
      background: var(--surface); color: var(--ink);
      border: 1px solid rgba(11,11,11,0.10); border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .card { --surface: #1a1a19; --ink: #fff; --ink-2: #c3c2b7; --line: #2c2c2a; --good: #0ca30c; --bad: #e66767;
              border-color: rgba(255,255,255,0.10); }
    }
    header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    header b { font-size: 13px; }
    button { all: unset; cursor: pointer; color: var(--ink-2); padding: 2px 6px; border-radius: 4px; }
    button:hover { background: var(--line); }
    .body { padding: 10px 12px; }
    .card.min .body, .card.min footer { display: none; }
    .score { font-size: 32px; font-weight: 600; line-height: 1.1; }
    .status { margin: 4px 0 8px; font-weight: 600; }
    .ok { color: var(--good); } .no { color: var(--bad); }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    li span:last-child { font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
    .reasons li { display: block; color: var(--bad); }
    h4 { margin: 10px 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    .note { color: var(--ink-2); }
    details { margin-top: 8px; color: var(--ink-2); }
    summary { cursor: pointer; color: var(--muted); }
    footer { display: flex; justify-content: space-between; padding: 8px 12px; border-top: 1px solid var(--line); color: var(--muted); }
    footer button { color: var(--ink); text-decoration: underline; padding: 0; }
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const listItems = (pairs) => pairs.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');

  function priceSection(row, analysis, config) {
    if (!row.eligible) return '';
    if (!analysis.model) {
      return `<h4>Fiyat</h4><p class="note">Fiyat kıyası için en az ${config.minListingsForFit} uygun ilan gerekiyor (şu an ${analysis.eligible.length}).</p>`;
    }
    const cheap = row.diff < 0;
    return `
      <h4>Fiyat (${analysis.eligible.length} ilana göre)</h4>
      <ul>${listItems([
        ['İlan fiyatı', tl(row.listing.price)],
        ['Skoruna göre beklenen', tl(row.predicted)],
      ])}</ul>
      <p class="status ${cheap ? 'ok' : 'no'}">${cheap ? '▼' : '▲'} ${tl(Math.abs(row.diff))} ${cheap ? 'ucuz' : 'pahalı'} (${pct(row.diffPct)})</p>`;
  }

  function parsedSection(l) {
    const parts = l.parts
      ? `lokal ${l.parts.localPainted.length} · boya ${l.parts.painted.length} · değişen ${l.parts.changed.length}`
      : 'okunamadı / belirtilmemiş';
    return `
      <details>
        <summary>Okunan veriler</summary>
        <ul>${listItems([
          ['İlan No', l.id],
          ['Model', l.model || '–'],
          ['Yıl', l.year ?? '–'],
          ['KM', int(l.km)],
          ['Vites', l.gear || '–'],
          ['Garanti', l.warranty == null ? '–' : l.warranty ? 'Evet' : 'Hayır'],
          ['Ağır hasar', l.heavyDamage == null ? '–' : l.heavyDamage ? 'Evet' : 'Hayır'],
          ['Boya/değişen', parts],
          ['Tramer', l.tramer == null ? 'bilinmiyor' : tl(l.tramer)],
        ])}</ul>
        ${l.tramerText ? `<p>“${esc(l.tramerText)}”</p>` : ''}
      </details>`;
  }

  SCC.renderPanel = function (row, analysis, config = SCC.config) {
    let host = document.getElementById('scc-panel-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scc-panel-host';
      host.attachShadow({ mode: 'open' });
      document.body.appendChild(host);
    }
    const root = host.shadowRoot;
    const minimized = root.querySelector('.card')?.classList.contains('min');

    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card ${minimized ? 'min' : ''}" lang="tr">
        <header><b>Clio Checker · skor ${row.score}</b><button data-act="min" title="Küçült">—</button></header>
        <div class="body">
          <div class="score">${row.score}</div>
          ${
            row.eligible
              ? `<p class="status ok">✓ Kriterlere uygun</p>`
              : `<p class="status no">✗ Elendi</p><ul class="reasons">${row.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
          }
          <h4>Puan dökümü (taban ${config.scoring.baseScore})</h4>
          <ul>${listItems(row.breakdown.map((b) => [b.label, signed(b.points, 1)]))}</ul>
          ${priceSection(row, analysis, config)}
          ${parsedSection(row.listing)}
        </div>
        <footer><span>${analysis.rows.length} ilan kayıtlı</span><button data-act="dash">Dashboard</button></footer>
      </div>`;

    root.querySelector('[data-act="min"]').onclick = () => root.querySelector('.card').classList.toggle('min');
    root.querySelector('[data-act="dash"]').onclick = () => chrome.runtime.sendMessage({ type: 'openDashboard' });
  };
})();
