var SCC = globalThis.SCC || (globalThis.SCC = {});

(() => {
  const norm = (s) => (s || '').toLocaleLowerCase('tr-TR');

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
    if (!norm(listing.brand).includes(norm(f.brand))) reasons.push(`Marka ${f.brand} değil`);
    if (!norm(listing.series).includes(norm(f.series))) reasons.push(`Seri ${f.series} değil`);
    if (listing.year == null) reasons.push('Yıl okunamadı');
    else if (listing.year < f.minYear) reasons.push(`${f.minYear} öncesi (${listing.year})`);
    if (!trim) reasons.push(`Paket uygun değil (${listing.model || '?'})`);
    if (listing.parts && listing.parts.changed.length > f.maxChangedParts) {
      reasons.push(`Değişen parça var (${listing.parts.changed.join(', ')})`);
    }
    if (!f.allowHeavyDamage && listing.heavyDamage === true) reasons.push('Ağır hasar kayıtlı');
    if (!listing.price) reasons.push('Fiyat okunamadı');
    return reasons;
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
      const lp = listing.parts.localPainted.length;
      const p = listing.parts.painted.length;
      add(`Lokal boya ×${lp}`, lp * s.localPaintPerPart);
      add(`Boya ×${p}`, p * s.paintPerPart);
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
    if (listing.warranty === false) add('Garanti yok', s.noWarranty);

    return items;
  }

  SCC.evaluate = function (listing, config = SCC.config) {
    const trim = detectTrim(listing, config.filters.allowedTrims);
    const reasons = checkFilters(listing, config.filters, trim);
    const items = breakdown(listing, config.scoring, trim);
    const score = config.scoring.baseScore + items.reduce((sum, i) => sum + i.points, 0);
    return { trim, eligible: reasons.length === 0, reasons, score: Math.round(score * 10) / 10, breakdown: items };
  };
})();
