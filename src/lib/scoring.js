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

  function checkFilters(listing, f, trim) {
    const reasons = [];
    if (listing.year == null) reasons.push('Yıl okunamadı');
    else if (f.minYear && listing.year < f.minYear) reasons.push(`${f.minYear} öncesi (${listing.year})`);
    if (f.allowedTrims && !trim) reasons.push(`Paket uygun değil (${listing.model || '?'})`);
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

  function breakdown(listing, s, trim) {
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
    if (trim) add(`Paket (${trim})`, s.trim[trim] || 0);
    if (listing.gear) add(`Vites (${listing.gear})`, s.gear[listing.gear] || 0);
    if (listing.color) add(`Renk (${listing.color})`, s.color[listing.color] || 0);
    if (listing.warranty === false) add('Garanti yok', s.noWarranty);

    return items;
  }

  // `config` is one group's config, from SCC.configFor.
  SCC.evaluate = function (listing, config) {
    const trim = detectTrim(listing, config.filters.allowedTrims || Object.keys(config.scoring.trim));
    const reasons = checkFilters(listing, config.filters, trim);
    const items = breakdown(listing, config.scoring, trim);
    const score = config.scoring.baseScore + items.reduce((sum, i) => sum + i.points, 0);
    return { trim, eligible: reasons.length === 0, reasons, score: Math.round(score * 10) / 10, breakdown: items };
  };
})();
