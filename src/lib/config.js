var SCC = globalThis.SCC || (globalThis.SCC = {});

// Everything tunable lives here. Listings are stored raw, so changing any value
// below re-scores every saved car the next time the panel or dashboard renders.
//
// Every car listing you open is saved and grouped by sahibinden's "Marka Seri"
// (e.g. "Renault Clio", "Hyundai i20"). Each group is scored and priced only
// against itself. `filters` and `scoring` below apply to every model; a profile
// under `models` overrides any part of them for that one model.
SCC.config = {
  // Hard filters: a listing that fails any of these is excluded from scoring
  // and from the price fit (it is still saved, with the reasons shown).
  filters: {
    minYear: null,
    // Matched against sahibinden's "Model" field (falls back to the title).
    // null = any trim; a list excludes every trim not on it.
    allowedTrims: null,
    maxChangedParts: 0,
    allowHeavyDamage: false,
  },

  // Placeholder weights, to be tuned. Score = baseScore + sum of the rules below.
  scoring: {
    baseScore: 100,
    km: { every: 10000, points: -3 },
    perYearOld: -4, // per year older than the current calendar year
    // Points per painted part, by body region (matched on sahibinden's part names in
    // scoring.js). A locally painted part counts localPaintFactor of the same value.
    paint: {
      roof: -15, // Tavan
      frontHood: -10, // Motor Kaputu
      rearHood: -6, // Bagaj Kapağı
      rearMudguard: -6, // Arka Çamurluk: welded to the body, unlike the front ones
      door: -5, // Kapı
      frontMudguard: -3, // Ön Çamurluk: bolt-on
      bumper: -1, // Tampon
      other: -5, // a part name none of the above matched
    },
    localPaintFactor: 0.5,
    tramer: { every: 5000, points: -1, max: -25 },
    unknownDamageInfo: -5, // seller left boya/değişen unspecified
    unknownTramer: 0,
    // Points per trim, matched like allowedTrims. Usually set per model.
    trim: {},
    gear: { Manuel: -10 },
    color: { Beyaz: -5 },
    noWarranty: -3,
  },

  // Per-model profiles, keyed "Marka Seri" exactly as the dashboard lists them.
  models: {
    "Renault Clio": {
      filters: {
        minYear: 2024,
        // Anything not listed here, e.g. Joy / Touch / Equilibre, is excluded.
        allowedTrims: ["Evolution", "Techno", "Icon", "RS Line", "Esprit Alpine"],
      },
      scoring: {
        trim: {
          Evolution: 0,
          Techno: 5,
          Icon: 5,
          "RS Line": 6,
          "Esprit Alpine": 8,
        },
      },
    },
  },

  // Fewer eligible listings than this in a model and no price line is fitted for it.
  minListingsForFit: 5,
  // A price within this share of the expected price is shown as "Normal fiyat"
  // rather than cheap or expensive.
  fairPriceBand: 0.03,
};
