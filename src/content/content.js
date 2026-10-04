(async () => {
  const listing = SCC.parseListing(document, location.href);
  if (!listing) return;

  // Only Clios are worth keeping; filters like year/trim are applied later so
  // loosening them in config brings already-seen cars back in.
  const isTarget =
    (listing.brand || '').toLocaleLowerCase('tr-TR').includes(SCC.config.filters.brand.toLocaleLowerCase('tr-TR')) &&
    (listing.series || '').toLocaleLowerCase('tr-TR').includes(SCC.config.filters.series.toLocaleLowerCase('tr-TR'));
  if (!isTarget) return;

  const render = async () => {
    const analysis = SCC.analyze(await SCC.storage.list());
    const row = analysis.rows.find((r) => r.listing.id === listing.id);
    if (row) SCC.renderPanel(row, analysis);
  };

  await SCC.storage.upsert(listing);
  await render();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.listings) render();
  });
})();
