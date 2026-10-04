var SCC = globalThis.SCC || (globalThis.SCC = {});

// Same idea as cheapest-nft/charting.py: fit price = slope * score + intercept
// over eligible listings, then price - predicted tells how cheap a car is for its score.
SCC.fitLine = function (points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null; // every car has the same score
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
};

// Scores and fits one "Marka Seri" group (see SCC.groupKey) with that group's config.
// Listings that were taken down (goneAt) stay out of everything else and come back
// on their own in `gone`, latest first.
SCC.analyzeGroup = function (key, listings, config = SCC.config) {
  const groupConfig = SCC.configFor(key, config);
  const evaluate = (stored) => {
    const listing = SCC.withOverrides(stored);
    return { listing, ...SCC.evaluate(listing, groupConfig) };
  };
  const rows = listings.filter((l) => !l.goneAt).map(evaluate);
  const gone = listings
    .filter((l) => l.goneAt)
    .map(evaluate)
    .sort((a, b) => b.listing.goneAt.localeCompare(a.listing.goneAt));
  const eligible = rows.filter((r) => r.eligible);
  const fit =
    eligible.length >= groupConfig.minListingsForFit
      ? SCC.fitLine(eligible.map((r) => ({ x: r.score, y: r.listing.price })))
      : null;

  if (fit) {
    for (const r of eligible) {
      r.predicted = fit.slope * r.score + fit.intercept;
      r.diff = r.listing.price - r.predicted;
      r.diffPct = r.diff / r.predicted;
      r.verdict = Math.abs(r.diffPct) <= groupConfig.fairPriceBand ? 'fair' : r.diff < 0 ? 'cheap' : 'dear';
    }
    eligible.sort((a, b) => a.diffPct - b.diffPct);
  }

  return { key, config: groupConfig, rows, eligible, excluded: rows.filter((r) => !r.eligible), gone, fit };
};

// Every group fitted separately, largest first.
SCC.analyze = function (listings, config = SCC.config) {
  const byKey = new Map();
  for (const listing of listings) {
    const key = SCC.groupKey(listing);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(listing);
  }
  return [...byKey]
    .map(([key, group]) => SCC.analyzeGroup(key, group, config))
    .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key, 'tr'));
};
