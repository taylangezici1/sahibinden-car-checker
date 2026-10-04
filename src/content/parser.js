var SCC = globalThis.SCC || (globalThis.SCC = {});

// Selectors are written from memory of sahibinden's markup and have fallbacks.
// If a field comes back empty, save the listing page into fixtures/ and fix it here.
(() => {
  const { clean, parseNumber } = SCC.format;
  const key = (s) => clean(s).toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '');

  const first = (doc, selectors) => {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  // The "İlan No / Marka / Seri / Model / Yıl / KM ..." table: <li><strong>label</strong><span>value</span></li>
  function readInfoList(doc) {
    const info = {};
    const items = doc.querySelectorAll('.classifiedInfoList li, .classifiedInfo li');
    for (const li of items) {
      const label = li.querySelector('strong');
      const value = li.querySelector('span') || label?.nextElementSibling;
      if (label && value) info[clean(label.textContent)] = clean(value.textContent);
    }
    return info;
  }

  function pick(info, ...labels) {
    const wanted = labels.map(key);
    for (const [k, v] of Object.entries(info)) {
      if (wanted.includes(key(k))) return v;
    }
    return null;
  }

  const yesNo = (v) => (v == null ? null : /^evet/i.test(v) ? true : /^hay[ıi]r/i.test(v) ? false : null);

  function readPrice(doc) {
    const meta = doc.querySelector('[itemprop="price"]')?.getAttribute('content');
    if (meta) return parseNumber(meta);
    const el = first(doc, ['.classifiedInfo > h3', '.classified-price-wrapper', '.classifiedInfo h3']);
    const m = clean(el?.textContent).match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:TL|₺)/);
    return m ? parseNumber(m[1]) : null;
  }

  const DAMAGE_CATEGORIES = [
    ['changed', /de[gğ]i[sş]/i],
    ['localPainted', /lokal/i],
    ['painted', /boya/i],
    ['original', /orijinal/i],
  ];

  function categoryOf(text) {
    const t = clean(text);
    if (!t) return null;
    return DAMAGE_CATEGORIES.find(([, re]) => re.test(t))?.[0] || null;
  }

  // "Boya, Değişen ve Hasar Bilgisi": one <ul> per category, the first <li> (or a
  // preceding heading) names the category, the rest are part names.
  function readDamage(doc) {
    const root = first(doc, [
      '.car-damage-info-list',
      '.car-damage-info',
      '[class*="damage-info"]',
      '[class*="car-parts"]',
    ]);
    if (!root) return null;

    const parts = { original: [], localPainted: [], painted: [], changed: [] };
    let found = false;
    for (const ul of root.querySelectorAll('ul')) {
      const titleEl = ul.querySelector('.pair-title') || ul.previousElementSibling;
      const cat = categoryOf(titleEl?.textContent);
      if (!cat) continue;
      found = true;
      for (const li of ul.querySelectorAll('li')) {
        if (li === titleEl || li.classList.contains('pair-title')) continue;
        const name = clean(li.textContent);
        if (name) parts[cat].push(name);
      }
    }
    const total = Object.values(parts).reduce((n, list) => n + list.length, 0);
    return found && total > 0 ? parts : null;
  }

  // Tramer is rarely a structured field, so also scan the title and description.
  function readTramer(info, text) {
    const field = pick(info, 'Tramer', 'Tramer Tutarı', 'Tramer Kaydı');
    if (field) {
      const n = parseNumber(field);
      if (n != null) return { amount: n, text: field };
      if (/yok|hay[ıi]r/i.test(field)) return { amount: 0, text: field };
    }

    const t = text.toLocaleLowerCase('tr-TR');
    const snippet = (i) => clean(text.slice(Math.max(0, i - 30), i + 50).replace(/^\S*\s|\s\S*$/g, ''));

    const none = t.match(/tramer\s*(?:kayd[ıi]\s*)?(?:yok|bulunmamakta)|tramers[ıi]z/);
    if (none) return { amount: 0, text: snippet(none.index) };

    const amountPatterns = [
      /tramer[^0-9]{0,25}?(\d[\d.,]*\s*(?:bin|k)?)/,
      /(\d[\d.,]*\s*(?:bin|k)?)\s*(?:tl|₺)?\s*(?:'?l[iı]k)?\s*tramer/,
    ];
    for (const re of amountPatterns) {
      const m = t.match(re);
      if (!m) continue;
      const n = parseNumber(m[1]);
      const looksLikeYear = /^\d{4}$/.test(m[1].trim()) && n >= 1990 && n <= 2035;
      if (n != null && n >= 500 && !looksLikeYear) return { amount: n, text: snippet(m.index) };
    }

    const noRecord = t.match(/hasar\s*kayd[ıi]\s*(?:yok|bulunmamakta)/);
    if (noRecord) return { amount: 0, text: snippet(noRecord.index) };
    return { amount: null, text: null };
  }

  SCC.parseListing = function (doc = document, url = location.href) {
    const info = readInfoList(doc);
    if (!pick(info, 'Marka') || !pick(info, 'KM')) return null; // not a car listing

    const id = pick(info, 'İlan No') || url.match(/(\d{6,})(?:\/detay)?\/?(?:[?#].*)?$/)?.[1];
    if (!id) return null;

    const title = clean(first(doc, ['.classifiedDetailTitle h1', 'h1'])?.textContent);
    const description = clean(first(doc, ['#classifiedDescription', '.classifiedDescription'])?.textContent);
    const tramer = readTramer(info, `${title}\n${description}`);
    const u = new URL(url);

    return {
      id: String(id).replace(/\D/g, ''),
      url: u.origin + u.pathname,
      title,
      price: readPrice(doc),
      brand: pick(info, 'Marka'),
      series: pick(info, 'Seri'),
      model: pick(info, 'Model'),
      year: parseNumber(pick(info, 'Yıl')),
      km: parseNumber(pick(info, 'KM')),
      fuel: pick(info, 'Yakıt Tipi', 'Yakıt'),
      gear: pick(info, 'Vites'),
      color: pick(info, 'Renk'),
      warranty: yesNo(pick(info, 'Garanti')),
      heavyDamage: yesNo(pick(info, 'Ağır Hasar Kayıtlı', 'Ağır Hasarlı')),
      seller: pick(info, 'Kimden'),
      location: clean(first(doc, ['.classifiedInfo > h2'])?.textContent),
      parts: readDamage(doc),
      tramer: tramer.amount,
      tramerText: tramer.text,
      info,
    };
  };
})();
