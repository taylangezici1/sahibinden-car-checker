var SCC = globalThis.SCC || (globalThis.SCC = {});

// Price vs score scatter with the fitted line, drawn as plain SVG (no remote code in MV3).
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  };

  function niceTicks(min, max, count = 5) {
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const raw = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => raw <= s);
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  const compactTl = (n) => n.toLocaleString('tr-TR', { notation: 'compact', maximumFractionDigits: 2 });

  SCC.drawScatter = function (container, rows, model, { onHover, onOpen }) {
    container.innerHTML = '';
    if (!rows.length) {
      container.innerHTML = '<p class="empty">Henüz kriterlere uygun ilan yok. sahibinden.com\'da Clio ilanlarını gezdikçe burada görünecek.</p>';
      return;
    }

    const width = Math.max(320, container.clientWidth);
    const height = Math.round(Math.min(420, Math.max(260, width * 0.45)));
    const m = { top: 12, right: 16, bottom: 40, left: 64 };
    const iw = width - m.left - m.right;
    const ih = height - m.top - m.bottom;

    const xTicks = niceTicks(Math.min(...rows.map((r) => r.score)), Math.max(...rows.map((r) => r.score)));
    const yTicks = niceTicks(Math.min(...rows.map((r) => r.listing.price)), Math.max(...rows.map((r) => r.listing.price)));
    const [x0, x1] = [xTicks[0], xTicks.at(-1)];
    const [y0, y1] = [yTicks[0], yTicks.at(-1)];
    const sx = (v) => m.left + ((v - x0) / (x1 - x0)) * iw;
    const sy = (v) => m.top + ih - ((v - y0) / (y1 - y0)) * ih;

    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Fiyat ve skor dağılımı' });

    for (const t of yTicks) {
      svg.append(el('line', { class: 'grid', x1: m.left, x2: m.left + iw, y1: sy(t), y2: sy(t) }));
      svg.append(el('text', { class: 'tick', x: m.left - 8, y: sy(t) + 4, 'text-anchor': 'end' }, compactTl(t)));
    }
    for (const t of xTicks) {
      svg.append(el('text', { class: 'tick', x: sx(t), y: m.top + ih + 16, 'text-anchor': 'middle' }, t.toLocaleString('tr-TR')));
    }
    svg.append(el('line', { class: 'axis', x1: m.left, x2: m.left + iw, y1: m.top + ih, y2: m.top + ih }));
    svg.append(el('text', { class: 'axis-title', x: m.left + iw / 2, y: height - 4, 'text-anchor': 'middle' }, 'Skor'));
    svg.append(
      el('text', { class: 'axis-title', transform: `translate(14 ${m.top + ih / 2}) rotate(-90)`, 'text-anchor': 'middle' }, 'Fiyat (TL)'),
    );

    if (model) {
      const clip = el('clipPath', { id: 'scc-plot' });
      clip.append(el('rect', { x: m.left, y: m.top, width: iw, height: ih }));
      svg.append(clip);
      svg.append(
        el('line', {
          class: 'fit',
          'clip-path': 'url(#scc-plot)',
          x1: sx(x0),
          y1: sy(model.slope * x0 + model.intercept),
          x2: sx(x1),
          y2: sy(model.slope * x1 + model.intercept),
        }),
      );
    }

    for (const r of rows) {
      const cx = sx(r.score);
      const cy = sy(r.listing.price);
      const cls = r.diff == null ? 'deal' : r.diff < 0 ? 'deal' : 'pricey';
      const hit = el('circle', { class: 'hit', cx, cy, r: 12 });
      const dot = el('circle', { class: `dot ${cls}`, cx, cy, r: 5 });
      hit.addEventListener('mousemove', (e) => onHover(r, e));
      hit.addEventListener('mouseleave', () => onHover(null));
      hit.addEventListener('click', () => onOpen(r));
      svg.append(hit, dot);
    }

    container.append(svg);
  };
})();
