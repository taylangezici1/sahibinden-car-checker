var SCC = globalThis.SCC || (globalThis.SCC = {});

// All listings live under one key: { listings: { [id]: listing } }.
SCC.storage = {
  async all() {
    const { listings = {} } = await chrome.storage.local.get('listings');
    return listings;
  },

  async list() {
    return Object.values(await SCC.storage.all());
  },

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

  async remove(id) {
    const all = await SCC.storage.all();
    delete all[id];
    await chrome.storage.local.set({ listings: all });
  },

  async replaceAll(listings) {
    await chrome.storage.local.set({ listings });
  },
};
