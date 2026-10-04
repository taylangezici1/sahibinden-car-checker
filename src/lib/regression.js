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

SCC.analyze = function (listings, config = SCC.config) {
  const rows = listings.map((listing) => ({ listing, ...SCC.evaluate(listing, config) }));
  const eligible = rows.filter((r) => r.eligible);
  const model =
    eligible.length >= config.minListingsForFit
      ? SCC.fitLine(eligible.map((r) => ({ x: r.score, y: r.listing.price })))
      : null;

  if (model) {
    for (const r of eligible) {
      r.predicted = model.slope * r.score + model.intercept;
      r.diff = r.listing.price - r.predicted;
      r.diffPct = r.diff / r.predicted;
    }
    eligible.sort((a, b) => a.diffPct - b.diffPct);
  }

  return { rows, eligible, excluded: rows.filter((r) => !r.eligible), model };
};
