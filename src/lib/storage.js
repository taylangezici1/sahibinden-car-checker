var SCC = globalThis.SCC || (globalThis.SCC = {});

// config.js as written, before the user's dashboard settings are laid over it.
SCC.defaultConfig = SCC.defaultConfig || SCC.config;

// All listings live under one key: { listings: { [id]: listing } }.
// The user's settings live under { settings: <partial config> }.
SCC.storage = {
  async all() {
    const { listings = {} } = await chrome.storage.local.get('listings');
    return listings;
  },

  async list() {
    return Object.values(await SCC.storage.all());
  },

  // Keeps `overrides` from earlier visits: a fresh parse never carries them.
  async upsert(listing) {
    const all = await SCC.storage.all();
    const prev = all[listing.id];
    const now = new Date().toISOString();
    const history = prev?.priceHistory ? [...prev.priceHistory] : [];
    if (listing.price && history.at(-1)?.price !== listing.price) {
      history.push({ price: listing.price, at: now });
    }
    all[listing.id] = {
      ...prev,
      ...listing,
      firstSeenAt: prev?.firstSeenAt || now,
      lastSeenAt: now,
      priceHistory: history,
    };
    await chrome.storage.local.set({ listings: all });
    return all;
  },

  // A value the user corrected by hand, e.g. setOverride(id, 'tramer', 12500).
  // `undefined` removes it so the value read from the page is used again.
  async setOverride(id, field, value) {
    const all = await SCC.storage.all();
    if (!all[id]) return;
    const overrides = { ...all[id].overrides };
    if (value === undefined) delete overrides[field];
    else overrides[field] = value;
    all[id] = { ...all[id], overrides };
    await chrome.storage.local.set({ listings: all });
  },

  async remove(id) {
    const all = await SCC.storage.all();
    delete all[id];
    await chrome.storage.local.set({ listings: all });
  },

  async replaceAll(listings) {
    await chrome.storage.local.set({ listings });
  },

  // Applies the saved dashboard settings to SCC.config and returns them.
  // Call before scoring, in every page that scores.
  async loadSettings() {
    const { settings = {} } = await chrome.storage.local.get('settings');
    SCC.config = SCC.merge(SCC.defaultConfig, settings);
    return settings;
  },

  // `settings` holds only the values that differ from config.js, so later edits
  // to config.js still reach anything the user did not change.
  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  },
};
