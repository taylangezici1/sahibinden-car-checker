var SCC = globalThis.SCC || (globalThis.SCC = {});

(() => {
  const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');

  // Cars are only compared within one "Marka Seri" group: a Clio's price says nothing about an i20's.
  SCC.groupKey = (listing) => [listing.brand, listing.series].filter(Boolean).join(' ') || 'Bilinmeyen';

  const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  function merge(base, over) {
    if (!isPlainObject(over)) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) {
      out[k] = isPlainObject(v) && isPlainObject(base[k]) ? merge(base[k], v) : v;
    }
    return out;
  }
  SCC.merge = merge;

  // Values the user typed in on the panel (listing.overrides, e.g. tramer) win over
  // what was read from the page. `parsed` keeps the page's values for display.
  // How the asking price moved since the listing was first saved (priceHistory gets a
  // point each time a visit or save sees a new price). null when it hasn't moved.
  SCC.priceChange = function (listing) {
    const history = listing.priceHistory || [];
    const from = history[0]?.price;
    const to = history.at(-1)?.price;
    if (history.length < 2 || !from || !to || from === to) return null;
    return { from, to, diff: to - from, pct: (to - from) / from, at: history.at(-1).at };
  };

  SCC.withOverrides = (listing) =>
    listing.overrides && Object.keys(listing.overrides).length
      ? { ...listing, ...listing.overrides, parsed: listing }
      : listing;

  // The shared filters and weights with the group's profile from config.models laid over them.
  SCC.configFor = function (key, config = SCC.config) {
    const { models = {}, ...defaults } = config;
    const profile = Object.entries(models).find(([k]) => norm(k) === norm(key))?.[1];
    return merge(defaults, profile);
  };

  // Longest name first so "Esprit Alpine" wins over a shorter overlapping name.
  function detectTrim(listing, trims) {
    const sorted = [...trims].sort((a, b) => b.length - a.length);
    for (const source of [listing.model, listing.title]) {
      const hay = norm(source);
      const hit = sorted.find((t) => hay.includes(norm(t)));
      if (hit) return hit;
    }
    return null;
  }

  // Whether a listing's trim is in, and the points it brings. sahibinden's "Model"
  // (e.g. "1.0 TCe Evolution") is the unit: a choice made for that exact model on the
  // dashboard (config.variants, see dashboard/settings.js) wins; otherwise the trim
  // names in config.js decide (filters.allowedTrims, scoring.trim, matched inside it).
  SCC.variantChoice = function (listing, config) {
    const trim = detectTrim(listing, config.filters.allowedTrims || Object.keys(config.scoring.trim));
    const own = config.variants?.[listing.model];
    return {
      trim,
      include: own?.include ?? (!config.filters.allowedTrims || Boolean(trim)),
      points: own?.points ?? (trim ? config.scoring.trim[trim] || 0 : 0),
      // Name the points after the whole model when they were set for it.
      label: own?.points != null || !trim ? listing.model : trim,
    };
  };

  function checkFilters(listing, f, variant) {
    const reasons = [];
    if (listing.year == null) reasons.push('Yıl okunamadı');
    else if (f.minYear && listing.year < f.minYear) reasons.push(`${f.minYear} öncesi (${listing.year})`);
    if (!variant.include) reasons.push(`Paket uygun değil (${listing.model || '?'})`);
    if (listing.parts && listing.parts.changed.length > f.maxChangedParts) {
      reasons.push(`Değişen parça var (${listing.parts.changed.join(', ')})`);
    }
    if (!f.allowHeavyDamage && listing.heavyDamage === true) reasons.push('Ağır hasar kayıtlı');
    if (!listing.price) reasons.push('Fiyat okunamadı');
    return reasons;
  }

  // First match wins, so "Bagaj Kapağı" is a rear hood and not a door.
  const PAINT_REGIONS = [
    ['roof', /tavan/],
    ['rearHood', /bagaj|arka\s*kaput/],
    ['frontHood', /kaput/],
    ['door', /kap[ıi]/],
    ['rearMudguard', /arka.*[çc]amurluk/],
    ['frontMudguard', /[çc]amurluk/],
    ['bumper', /tampon/],
  ];

  function paintPoints(name, s) {
    const region = PAINT_REGIONS.find(([, re]) => re.test(norm(name)))?.[0];
    return s.paint[region] ?? s.paint.other;
  }

  function breakdown(listing, s, variant) {
    const items = [];
    const add = (label, points) => {
      if (points) items.push({ label, points });
    };

    if (listing.km != null) {
      add(`KM (${SCC.format.int(listing.km)})`, Math.round((listing.km / s.km.every) * s.km.points * 10) / 10);
    }
    if (listing.year != null) {
      const age = Math.max(0, new Date().getFullYear() - listing.year);
      add(`Yaş (${listing.year})`, age * s.perYearOld);
    }
    if (listing.parts) {
      for (const name of listing.parts.painted) add(`Boya: ${name}`, paintPoints(name, s));
      for (const name of listing.parts.localPainted) {
        add(`Lokal boya: ${name}`, Math.round(paintPoints(name, s) * s.localPaintFactor * 10) / 10);
      }
    } else {
      add('Boya/değişen belirtilmemiş', s.unknownDamageInfo);
    }
    if (listing.tramer == null) {
      add('Tramer bilinmiyor', s.unknownTramer);
    } else if (listing.tramer > 0) {
      const raw = (listing.tramer / s.tramer.every) * s.tramer.points;
      add(`Tramer (${SCC.format.tl(listing.tramer)})`, Math.round(Math.max(raw, s.tramer.max) * 10) / 10);
    }
    add(`Paket (${variant.label})`, variant.points);
    if (listing.gear) add(`Vites (${listing.gear})`, s.gear[listing.gear] || 0);
    if (listing.color) add(`Renk (${listing.color})`, s.color[listing.color] || 0);
    if (listing.warranty === false) add('Garanti yok', s.noWarranty);

    return items;
  }

  // `config` is one group's config, from SCC.configFor.
  SCC.evaluate = function (listing, config) {
    const variant = SCC.variantChoice(listing, config);
    const reasons = checkFilters(listing, config.filters, variant);
    const items = breakdown(listing, config.scoring, variant);
    const score = config.scoring.baseScore + items.reduce((sum, i) => sum + i.points, 0);
    return { trim: variant.trim, eligible: reasons.length === 0, reasons, score: Math.round(score * 10) / 10, breakdown: items };
  };
})();
