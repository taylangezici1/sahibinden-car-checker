var SCC = globalThis.SCC || (globalThis.SCC = {});

// sahibinden categories whose listings are read and scored, as they appear in listing
// URLs (/ilan/vasita-<category>-...). Keep the first content_scripts "matches" in
// manifest.json in step with this list.
SCC.CAR_CATEGORIES = ['otomobil', 'arazi-suv-pickup'];

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

  // The "İlan No / Marka / Seri / Model / Yıl / KM ..." table. Current markup (fixtures/) is
  // <dl class="classifiedInfoList"><div class="classifiedInfoItem"><dt>label</dt><dd>value</dd></div>,
  // older pages used <li><strong>label</strong><span>value</span></li>.
  function readInfoList(doc) {
    const info = {};
    for (const dt of doc.querySelectorAll('.classifiedInfoList dt')) {
      const dd = dt.nextElementSibling;
      if (dd?.tagName === 'DD') info[clean(dt.textContent)] = clean(dd.textContent);
    }
    const items = doc.querySelectorAll('.classifiedInfoList li, .classifiedInfo li');
    for (const li of items) {
      const label = li.querySelector('strong');
      const value = li.querySelector('span') || label?.nextElementSibling;
      if (label && value) info[clean(label.textContent)] = clean(value.textContent);
    }
    return info;
  }
  SCC.readInfoList = readInfoList;

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
    const el = first(doc, ['.classifiedPriceValue', '.classifiedInfo > h3', '.classified-price-wrapper', '.classifiedInfo h3']);
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

  // The car diagram: <div class="car-parts"><div class="front-hood original-new">. Part keys
  // are fixed, so this is preferred over the text list. State classes do not always match
  // the legend above it: the legend says "local-painted-new", parts say "localpainted-new".
  const DIAGRAM_PARTS = {
    'front-bumper': 'Ön Tampon',
    'front-hood': 'Motor Kaputu',
    roof: 'Tavan',
    'front-right-mudguard': 'Sağ Ön Çamurluk',
    'front-right-door': 'Sağ Ön Kapı',
    'rear-right-door': 'Sağ Arka Kapı',
    'rear-right-mudguard': 'Sağ Arka Çamurluk',
    'front-left-mudguard': 'Sol Ön Çamurluk',
    'front-left-door': 'Sol Ön Kapı',
    'rear-left-door': 'Sol Arka Kapı',
    'rear-left-mudguard': 'Sol Arka Çamurluk',
    'rear-hood': 'Bagaj Kapağı',
    'rear-bumper': 'Arka Tampon',
  };
  const DIAGRAM_STATES = [
    ['localPainted', /^local-?painted/],
    ['painted', /^painted/],
    ['changed', /^changed/],
    ['original', /^original/],
  ];

  function readDamageDiagram(doc) {
    const parts = { original: [], localPainted: [], painted: [], changed: [] };
    let total = 0;
    for (const el of doc.querySelectorAll('.car-parts > div')) {
      const classes = [...el.classList];
      const name = DIAGRAM_PARTS[classes.find((c) => Object.hasOwn(DIAGRAM_PARTS, c))];
      if (!name) continue;
      const state = DIAGRAM_STATES.find(([, re]) => classes.some((c) => re.test(c)))?.[0];
      // An unrecognised state would silently drop a damaged part; let the text list decide instead.
      if (!state) return null;
      parts[state].push(name);
      total++;
    }
    return total > 0 ? parts : null;
  }

  // "Boya, Değişen ve Hasar Bilgisi": one <ul> per category, the first <li> (or a
  // preceding heading) names the category, the rest are part names.
  function readDamageList(doc) {
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

  const readDamage = (doc) => readDamageDiagram(doc) || readDamageList(doc);

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

    const noRecord = t.match(/hasar\s*kayd[ıi]\s*(?:yok|bulunmamakta)|hasar\s*kay[ıi]ts[ıi]z/);
    if (noRecord) return { amount: 0, text: snippet(noRecord.index) };

    // Last resort: an ad that calls the car "hatasız" or "boyasız" and never gives
    // a tramer amount is taken to have none.
    const spotless = t.match(/hatas[ıi]z|boyas[ıi]z/);
    if (spotless) return { amount: 0, text: snippet(spotless.index) };
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
      fuel: pick(info, 'Yakıt / Motor Tipi', 'Yakıt Tipi', 'Yakıt'),
      gear: pick(info, 'Vites'),
      color: pick(info, 'Renk'),
      warranty: yesNo(pick(info, 'Servis Garantisi', 'Garanti')),
      heavyDamage: yesNo(pick(info, 'Ağır Hasar Kayıtlı', 'Ağır Hasarlı')),
      seller: pick(info, 'Kimden'),
      location: clean(first(doc, ['.classifiedLocation', '.classifiedInfo > h2'])?.textContent),
      parts: readDamage(doc),
      tramer: tramer.amount,
      tramerText: tramer.text,
      info,
    };
  };

  // Page text is lower-cased the Turkish way before matching: /i does not take "İ" for
  // "i", so /ilan/i misses "İlan bulunamadı" and anything shown in capitals.
  const pageText = (doc) => `${doc.title} ${doc.body?.innerText ?? doc.body?.textContent ?? ''}`.toLocaleLowerCase('tr-TR');

  // Some taken-down listings still show their details under a banner.
  SCC.hasGoneBanner = (doc = document) => /bu ilan (artık )?yayında değil|bu ilan yayından kaldırıl/.test(pageText(doc));

  // Every sahibinden page carries a reCAPTCHA and a Turnstile box in its hidden login
  // popup, so only one that is on show means a check page.
  const CAPTCHA = '[id*="captcha" i], [class*="captcha" i], [id*="turnstile" i], [class*="turnstile" i], iframe[src*="challenges.cloudflare.com"]';

  // Why a page that should be a listing isn't one: 'gone' (listing taken down),
  // 'botcheck' (captcha / unusual traffic page: stop saving and let the person solve
  // it), or null when it's something else.
  SCC.pageProblem = function (doc = document) {
    const text = pageText(doc);
    if (/yayında değil|yayından kaldırıl|ilan bulunamadı/.test(text)) return 'gone';
    const captcha = [...doc.querySelectorAll(CAPTCHA)].some((el) => el.checkVisibility?.() ?? false);
    if (captcha || /olağan ?dışı|robot olmadığ|güvenlik doğrulama/.test(text)) return 'botcheck';
    return null;
  };
})();
