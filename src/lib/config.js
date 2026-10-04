var SCC = globalThis.SCC || (globalThis.SCC = {});

// Everything tunable lives here. Listings are stored raw, so changing any value
// below re-scores every saved car the next time the panel or dashboard renders.
SCC.config = {
  // Hard filters: a listing that fails any of these is excluded from scoring
  // and from the price fit (it is still saved, with the reasons shown).
  filters: {
    brand: 'Renault',
    series: 'Clio',
    minYear: 2024,
    // Matched against sahibinden's "Model" field (falls back to the title).
    // Anything not listed here, e.g. Joy / Touch / Equilibre, is excluded.
    allowedTrims: ['Evolution', 'Techno', 'Icon', 'RS Line', 'Esprit Alpine'],
    maxChangedParts: 0,
    allowHeavyDamage: false,
  },

  // Placeholder weights, to be tuned. Score = baseScore + sum of the rules below.
  scoring: {
    baseScore: 100,
    km: { every: 10000, points: -2 },
    perYearOld: -4, // per year older than the current calendar year
    localPaintPerPart: -3,
    paintPerPart: -6,
    tramer: { every: 5000, points: -1, max: -25 },
    unknownDamageInfo: -5, // seller left boya/değişen unspecified
    unknownTramer: 0,
    trim: { Evolution: 0, Techno: 5, Icon: 5, 'RS Line': 6, 'Esprit Alpine': 8 },
    gear: { Manuel: -10 },
    noWarranty: -3,
  },

  // Fewer eligible listings than this and no price line is fitted.
  minListingsForFit: 5,
};
