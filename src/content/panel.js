var SCC = globalThis.SCC || (globalThis.SCC = {});

// The panel on a listing page. Written for a non-technical reader: the verdict
// comes first in plain words, details are one click away.
(() => {
  const { tl, int, signed, percent, score, ago } = SCC.format;
  const APP_NAME = chrome.runtime.getManifest().name;

  const LOGO = SCC.LOGO_SVG;

  const STYLE = `
    :host { all: initial; }
    .card {
      --surface: #ffffff; --soft: #f4f4f1; --ink: #141414; --ink-2: #45443f; --line: #e3e2dc;
      --brand: #1d5fb8;
      --good: #0b6b2e; --good-bg: #e8f5ec; --good-line: #9bd3ad;
      --bad: #b42318; --bad-bg: #fdeeec; --bad-line: #f1a9a0;
      --fair: #2b4a75; --fair-bg: #edf2f9; --fair-line: #b5c8e3;
      --off: #45443f; --off-bg: #f3f2ee; --off-line: #d6d4cc;
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      box-sizing: border-box; width: 380px; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); overflow: auto;
      background: var(--surface); color: var(--ink);
      border: 1px solid rgba(0,0,0,.14); border-radius: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.22);
      font: 16px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    .card * { box-sizing: border-box; }
    .card.min { width: auto; }
    .card.min .body, .card.min footer { display: none; }

    header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px;
             padding: 12px 14px; background: var(--surface); border-bottom: 1px solid var(--line); }
    .card.min header { border-bottom: 0; }
    .logo svg { display: block; width: 36px; height: 36px; }
    .title { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
    .title b { font-size: 16px; }
    .title span { font-size: 14px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip { display: none; font-size: 14px; font-weight: 700; padding: 2px 10px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
    .card.min .chip { display: inline-block; }

    button { font: inherit; cursor: pointer; border-radius: 8px; }
    .ghost { border: 1px solid var(--line); background: var(--surface); color: var(--ink); padding: 6px 12px; font-size: 15px; }
    .ghost:hover { background: var(--soft); }
    .primary { display: block; width: 100%; min-height: 48px; padding: 10px 16px; border: 0;
               background: var(--brand); color: #fff; font-size: 17px; font-weight: 600; }
    .primary:hover { filter: brightness(1.1); }
    .link { border: 0; background: none; padding: 0; color: var(--brand); text-decoration: underline; }

    .body { display: grid; gap: 16px; padding: 14px; }
    .good { color: var(--good); background: var(--good-bg); border-color: var(--good-line); }
    .bad  { color: var(--bad);  background: var(--bad-bg);  border-color: var(--bad-line); }
    .fair { color: var(--fair); background: var(--fair-bg); border-color: var(--fair-line); }
    .off, .wait { color: var(--off); background: var(--off-bg); border-color: var(--off-line); }

    .verdict { border: 2px solid; border-radius: 12px; padding: 12px 14px; }
    .v-word { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; line-height: 1.2; }
    .verdict p { margin: 6px 0 0; color: var(--ink); }

    ul { list-style: none; margin: 0; padding: 0; }
    .list li { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid var(--line); }
    .list li:last-child { border-bottom: 0; }
    .list li span:last-child { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .verdict .list { margin-top: 10px; color: var(--ink); }
    .verdict .list li { border-color: rgba(0,0,0,.08); }
    .rank { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 10px 12px; line-height: 1.35;
            color: #5c3b00; background: #fff8e6; border: 2px solid #f3d27a; border-radius: 10px; }
    .rank.podium { background: #fff1c7; border-color: #e9b42a; }
    .rank b { font-size: 17px; }
    .rank-num { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
                font-size: 19px; font-weight: 800; color: #3d2900; background: #f8d77a; }
    .podium .rank-num { background: #f5b301; }
    .price-change { margin: 10px 0 0; padding: 8px 10px; font-weight: 700; background: var(--surface); border: 1px solid; border-radius: 8px; }
    .price-change span { font-weight: 400; color: var(--ink-2); }
    .price-change.down { color: var(--good); border-color: var(--good-line); }
    .price-change.up { color: var(--bad); border-color: var(--bad-line); }
    .reasons { margin-top: 6px; color: var(--ink); }
    .reasons li { position: relative; padding: 2px 0 2px 18px; }
    .reasons li::before { content: "•"; position: absolute; left: 4px; }

    .score-head { display: flex; justify-content: space-between; align-items: baseline; }
    .score-head span { font-weight: 600; }
    .score-head b { font-size: 30px; line-height: 1; }
    .bar { height: 12px; margin: 8px 0 4px; overflow: hidden; background: var(--soft); border: 1px solid var(--line); border-radius: 999px; }
    .bar i { display: block; height: 100%; background: var(--brand); border-radius: 999px; }
    .hint { margin: 6px 0; color: var(--ink-2); font-size: 15px; }

    .tramer { padding: 12px 14px; background: var(--soft); border: 1px solid var(--line); border-radius: 12px; }
    .tramer-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .tramer-head span { font-weight: 600; }
    .tramer-value { font-size: 20px; font-weight: 700; }
    .tramer .hint { margin-bottom: 0; }
    .tramer form { margin-top: 12px; }
    .tramer label { display: block; margin-bottom: 6px; font-weight: 600; }
    .field { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .field input { flex: 1; min-width: 0; padding: 8px 10px; font: inherit; font-size: 18px; color: var(--ink);
                   background: var(--surface); border: 2px solid var(--off-line); border-radius: 8px; }
    .field input:focus { outline: none; border-color: var(--brand); }
    .error { margin: 6px 0 0; color: var(--bad); font-weight: 600; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .secondary { min-height: 42px; padding: 8px 14px; font-size: 16px; color: var(--ink); background: var(--surface); border: 1px solid var(--off-line); }
    .secondary:hover { border-color: var(--brand); }
    .save { min-height: 42px; padding: 8px 18px; font-size: 16px; font-weight: 600; color: #fff; background: var(--brand); border: 0; }
    .save:hover { filter: brightness(1.1); }

    details { border-top: 1px solid var(--line); padding-top: 10px; }
    summary { cursor: pointer; font-weight: 600; padding: 4px 0; }
    details .list { margin-top: 6px; }
    footer { padding: 12px 14px 14px; border-top: 1px solid var(--line); }
    footer .hint { margin: 8px 0 0; text-align: center; }
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const listItems = (pairs) => pairs.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');

  function verdictOf(row, group) {
    if (!row.eligible) {
      return { tone: 'off', icon: '✗', word: 'Uygun değil', text: 'Bu ilan aradığınız özelliklere uymuyor:' };
    }
    if (!group.fit) {
      const missing = group.config.minListingsForFit - group.eligible.length;
      return {
        tone: 'wait',
        icon: 'ℹ',
        word: 'Henüz karşılaştırılamıyor',
        text:
          missing > 0
            ? `Fiyatı değerlendirebilmek için bu modelden ${missing} uygun ilan daha açın. Şu an ${group.eligible.length} ilan var.`
            : 'Bu modeldeki ilanların puanları aynı olduğu için karşılaştırma yapılamıyor.',
      };
    }
    const diff = `${tl(Math.abs(row.diff))} (${percent(row.diffPct)})`;
    if (row.verdict === 'cheap') {
      return { tone: 'good', icon: '▼', word: 'Ucuz', text: `Bu kalitedeki bir araç için beklenen fiyattan ${diff} daha ucuz.` };
    }
    if (row.verdict === 'dear') {
      return { tone: 'bad', icon: '▲', word: 'Pahalı', text: `Bu kalitedeki bir araç için beklenen fiyattan ${diff} daha pahalı.` };
    }
    return { tone: 'fair', icon: '●', word: 'Normal fiyat', text: `Bu kalitedeki bir araç için beklenen fiyatta (${percent(row.diffPct)} fark).` };
  }

  // Places near the top of the deals table get a highlighted block of their own.
  // A tier only counts when there are more cars than it covers ("top 10 of 6" says nothing).
  function rankHighlight(rank, total, key) {
    const tier =
      rank === 1 && total > 1 ? 'En iyi fırsat!'
      : rank <= 3 && total > 3 ? 'En iyi 3 fırsattan biri'
      : rank <= 10 && total > 10 ? 'En iyi 10 fırsattan biri'
      : null;
    if (!tier) return '';
    return `<div class="rank${rank <= 3 ? ' podium' : ''}">
      <span class="rank-num">${rank}.</span>
      <span><b>${tier}</b><br>${int(total)} ${esc(key)} ilanı içinde ${rank}. sırada</span>
    </div>`;
  }

  // "▼ Fiyatı düştü: 1.450.000 → 1.395.000 TL", since the listing was first saved.
  function priceChangeLine(listing) {
    const c = SCC.priceChange(listing);
    if (!c) return '';
    const down = c.diff < 0;
    return `<p class="price-change ${down ? 'down' : 'up'}">
      ${down ? '▼ Fiyatı düştü' : '▲ Fiyatı arttı'}: ${tl(c.from)} → ${tl(c.to)}
      <span>(${tl(Math.abs(c.diff))}, ${ago(c.at)})</span>
    </p>`;
  }

  function verdictSection(row, group, v) {
    const reasons = row.eligible ? '' : `<ul class="reasons">${row.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
    // Same order as the dashboard's "En iyi fırsatlar" table (cheapest for its score first).
    const rank = group.eligible.indexOf(row) + 1;
    const total = group.eligible.length;
    const top = row.eligible && group.fit ? rankHighlight(rank, total, group.key) : '';
    const prices =
      row.eligible && group.fit
        ? `<ul class="list">${listItems([
            ['İlan fiyatı', tl(row.listing.price)],
            ['Beklenen fiyat', tl(row.predicted)],
            ...(top ? [] : [['Fırsat sırası', `${int(total)} ilan içinde ${rank}.`]]),
          ])}</ul>${top}
          <p class="hint">${group.eligible.length} ${esc(group.key)} ilanına göre hesaplandı.</p>`
        : '';
    return `
      <section class="verdict ${v.tone}">
        <div class="v-word"><span aria-hidden="true">${v.icon}</span>${esc(v.word)}</div>
        <p>${esc(v.text)}</p>
        ${priceChangeLine(row.listing)}
        ${reasons}${prices}
      </section>`;
  }

  function scoreSection(row, group) {
    const base = group.config.scoring.baseScore;
    const fill = Math.max(0, Math.min(100, (row.score / base) * 100));
    const items = row.breakdown.length
      ? `<ul class="list">${listItems(row.breakdown.map((b) => [b.label, signed(b.points, 1)]))}</ul>`
      : '<p class="hint">Puanı düşüren bir şey bulunmadı.</p>';
    return `
      <section>
        <div class="score-head"><span>Kalite puanı</span><b>${score(row.score)}</b></div>
        <div class="bar" role="img" aria-label="Kalite puanı ${score(row.score)} / ${base}"><i style="width: ${fill}%"></i></div>
        <p class="hint">Kusursuz bir araç ${base} puan alır. Puanı etkileyenler:</p>
        ${items}
      </section>`;
  }

  const tramerValue = (t) => (t == null ? 'Bilinmiyor' : t === 0 ? 'Yok' : tl(t));

  // Tramer is often missing or vague in ads; the reader can look it up and type it in.
  function tramerSection(l) {
    const manual = l.overrides?.tramer !== undefined;
    const source = manual
      ? 'Bu bilgiyi siz girdiniz.'
      : l.tramer == null
        ? 'İlanda tramer bilgisi bulunamadı. Biliyorsanız girin, puan ona göre hesaplansın.'
        : l.tramerText
          ? `İlandan okundu: “${esc(l.tramerText)}”`
          : 'İlandan okundu.';
    return `
      <section class="tramer">
        <div class="tramer-head">
          <div><span>Tramer (hasar kaydı)</span><div class="tramer-value">${tramerValue(l.tramer)}</div></div>
          <button class="secondary" data-act="tramer-edit">${l.tramer == null ? 'Gir' : 'Değiştir'}</button>
        </div>
        <p class="hint">${source}
          ${manual ? ` <button class="link" data-act="tramer-reset">İlandaki bilgiye geri dön</button>` : ''}</p>
        <form data-tramer-form hidden>
          <label for="scc-tramer">Tramer tutarı</label>
          <div class="field">
            <input id="scc-tramer" inputmode="numeric" autocomplete="off" placeholder="örneğin 12.500" value="${l.tramer > 0 ? int(l.tramer) : ''}">
            <span>TL</span>
          </div>
          <p class="error" hidden></p>
          <div class="acts">
            <button type="submit" class="save">Kaydet</button>
            <button type="button" class="secondary" data-act="tramer-none">Tramer yok</button>
            <button type="button" class="secondary" data-act="tramer-cancel">Vazgeç</button>
          </div>
        </form>
      </section>`;
  }

  // While the tramer form is open, re-renders (e.g. a listing saved in another tab)
  // wait so a half-typed amount is not wiped; the latest one runs when it closes.
  let editing = false;
  let pending = null;

  function wireTramer(root, listing) {
    const form = root.querySelector('[data-tramer-form]');
    const input = form.querySelector('input');
    const error = form.querySelector('.error');
    const editButton = root.querySelector('[data-act="tramer-edit"]');

    const close = () => {
      editing = false;
      form.hidden = true;
      editButton.hidden = false;
      if (pending) {
        const args = pending;
        pending = null;
        SCC.renderPanel(...args);
      }
    };
    // The storage change re-renders the panel with the new score.
    const save = (value) => {
      if (SCC.staleNotice()) return;
      editing = false;
      pending = null;
      return SCC.storage.setOverride(listing.id, 'tramer', value);
    };

    editButton.onclick = () => {
      if (SCC.staleNotice()) return;
      editing = true;
      form.hidden = false;
      editButton.hidden = true;
      input.focus();
      input.select();
    };
    root.querySelector('[data-act="tramer-cancel"]').onclick = close;
    root.querySelector('[data-act="tramer-none"]').onclick = () => save(0);
    root.querySelector('[data-act="tramer-reset"]')?.addEventListener('click', () => save(undefined));
    // Keys typed here must not reach sahibinden's own page shortcuts.
    for (const type of ['keydown', 'keypress', 'keyup']) input.addEventListener(type, (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    form.onsubmit = (e) => {
      e.preventDefault();
      const value = SCC.format.parseNumber(input.value);
      if (value == null) {
        error.textContent = 'Lütfen bir tutar yazın, örneğin 12.500. Tramer yoksa "Tramer yok" düğmesine basın.';
        error.hidden = false;
        input.focus();
        return;
      }
      save(value);
    };
  }

  function partsText(parts) {
    if (!parts) return 'Belirtilmemiş';
    const bits = [
      [parts.localPainted.length, 'lokal boyalı'],
      [parts.painted.length, 'boyalı'],
      [parts.changed.length, 'değişen'],
    ].filter(([n]) => n > 0);
    return bits.length ? bits.map(([n, label]) => `${n} ${label}`).join(', ') : 'Hepsi orijinal';
  }

  function detailsSection(l) {
    const yesNo = (v) => (v == null ? '–' : v ? 'Evet' : 'Hayır');
    return `
      <details>
        <summary>İlandan okunan bilgiler</summary>
        <ul class="list">${listItems([
          ['Model', l.model || '–'],
          ['Yıl', l.year ?? '–'],
          ['Kilometre', int(l.km)],
          ['Vites', l.gear || '–'],
          ['Renk', l.color || '–'],
          ['Garanti', yesNo(l.warranty)],
          ['Ağır hasar kaydı', yesNo(l.heavyDamage)],
          ['Boya / değişen', partsText(l.parts)],
          ['İlan no', l.id],
        ])}</ul>
        <p class="hint">Bilgiler yanlış mı? <button class="link" data-act="html">Sayfayı kaydedin</button> ve eklentiyi kuran kişiye gönderin.</p>
      </details>`;
  }

  // A host can also come without a shadow root, e.g. in a page saved with the panel on it.
  function shadowRoot() {
    let host = document.getElementById('scc-panel-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scc-panel-host';
      document.body.appendChild(host);
    }
    return host.shadowRoot || host.attachShadow({ mode: 'open' });
  }

  // Downloads the DOM as the content script sees it, to drop into fixtures/ when the parser misses a field.
  SCC.savePageHtml = function () {
    const id = location.pathname.match(/(\d{6,})/)?.[1] || 'page';
    const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sahibinden-${id}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Shown instead of the score when the page could not be read, so a parser miss is never silent.
  SCC.renderNotice = function (message, details = []) {
    const root = shadowRoot();
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card" lang="tr">
        <header><span class="logo">${LOGO}</span><div class="title"><b>${esc(APP_NAME)}</b></div></header>
        <div class="body">
          <section class="verdict off">
            <div class="v-word"><span aria-hidden="true">✗</span>${esc(message)}</div>
            <p>Lütfen aşağıdaki düğmeyle sayfayı kaydedip eklentiyi kuran kişiye gönderin.</p>
          </section>
          <details><summary>Teknik ayrıntı</summary><ul class="reasons">${details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></details>
        </div>
        <footer><button class="primary" data-act="html">Sayfayı kaydet</button></footer>
      </div>`;
    root.querySelector('[data-act="html"]').onclick = SCC.savePageHtml;
  };

  // `group` is this listing's model group, from SCC.analyzeGroup.
  SCC.renderPanel = function (row, group) {
    if (editing) {
      pending = [row, group];
      return;
    }
    const root = shadowRoot();
    // A redraw (e.g. a listing saved in another tab) keeps how the reader left the panel.
    const old = root.querySelector('.card');
    const minimized = old?.classList.contains('min');
    const detailsOpen = root.querySelector('details')?.open;
    const scrollTop = old?.scrollTop || 0;
    const v = verdictOf(row, group);

    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card ${minimized ? 'min' : ''}" lang="tr">
        <header>
          <span class="logo">${LOGO}</span>
          <div class="title"><b>${esc(APP_NAME)}</b><span>${esc(group.key)}</span></div>
          <span class="chip ${v.tone}">${esc(v.word)}</span>
          <button class="ghost" data-act="min">${minimized ? 'Aç' : 'Küçült'}</button>
        </header>
        <div class="body">
          ${verdictSection(row, group, v)}
          ${tramerSection(row.listing)}
          ${scoreSection(row, group)}
          ${detailsSection(row.listing)}
        </div>
        <footer>
          <button class="primary" data-act="dash">Tüm ${esc(group.key)} ilanlarını karşılaştır</button>
          <p class="hint">Bu modelden ${group.rows.length} ilan kaydedildi.</p>
        </footer>
      </div>`;
    if (detailsOpen) root.querySelector('details').open = true;
    root.querySelector('.card').scrollTop = scrollTop;

    root.querySelector('[data-act="min"]').onclick = (e) => {
      const min = root.querySelector('.card').classList.toggle('min');
      e.currentTarget.textContent = min ? 'Aç' : 'Küçült';
    };
    root.querySelector('[data-act="html"]').onclick = SCC.savePageHtml;
    wireTramer(root, row.listing);
    root.querySelector('[data-act="dash"]').onclick = () => {
      if (SCC.staleNotice()) return;
      chrome.runtime.sendMessage({ type: 'openDashboard', group: group.key });
    };
  };
})();
