(async () => {
  // When "Kaydet" on a results page opened this tab, the background script waits
  // for this to close it again (see saveViaTab in background.js). Otherwise it's ignored.
  // Resolves to whether such a "Kaydet" was waiting.
  const done = (status) => chrome.runtime.sendMessage({ type: 'listingDone', status }).catch(() => false);

  try {
    const listing = SCC.parseListing(document, location.href);
    if (!listing) {
      const problem = SCC.pageProblem(document);
      // A saved listing that's no longer up: keep it, but out of the comparison.
      if (problem === 'gone') {
        const id = location.pathname.match(/(\d{6,})(?:\/detay)?\/?$/)?.[1];
        const saved = id ? await SCC.storage.markGone(id) : false;
        // Opened by hand (e.g. from the dashboard), not by "Kaydet": nothing left to see.
        if (!(await done(problem)) && saved) SCC.leaveSoon();
        return;
      }
      done(problem || 'unreadable');
      if (problem) return; // sahibinden's own page says what's wrong
      const labels = Object.keys(SCC.readInfoList(document));
      console.warn('[SCC] İlan okunamadı. Bilgi tablosundan okunan başlıklar:', labels);
      SCC.renderNotice('Bu ilan okunamadı', [
        labels.length
          ? `Marka/KM bulunamadı. Okunan başlıklar: ${labels.join(', ')}`
          : 'İlan bilgi tablosu (Marka, Seri, KM...) sayfada bulunamadı',
      ]);
      return;
    }

    // Every car is kept; filters like year/trim are applied when scoring, so
    // loosening them in config brings already-seen cars back in.
    const key = SCC.groupKey(listing);
    // Skips redraws when nothing this panel shows has changed, e.g. a listing of
    // another model saved in another tab, or only a lastSeenAt bump.
    let shown = '';
    const render = async () => {
      const settings = await SCC.storage.loadSettings();
      const sameModel = (await SCC.storage.list()).filter((l) => SCC.groupKey(l) === key);
      const snapshot = JSON.stringify([settings, sameModel], (k, v) => (k === 'lastSeenAt' ? undefined : v));
      if (snapshot === shown) return;
      shown = snapshot;
      const group = SCC.analyzeGroup(key, sameModel);
      const row = group.rows.find((r) => r.listing.id === listing.id);
      if (row) SCC.renderPanel(row, group);
    };

    // Some taken-down listings still show their details under the notice.
    const gone = SCC.saysListingGone(document);
    if (gone) listing.goneAt = new Date().toISOString();
    const saved = Boolean((await SCC.storage.all())[listing.id]);
    await SCC.storage.upsert(listing);
    if (!(await done(gone ? 'gone' : 'ok')) && gone && saved) SCC.leaveSoon();
    await render();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.listings || changes.settings)) render();
    });
  } catch (err) {
    console.error('[SCC]', err);
    done('unreadable');
    SCC.renderNotice('Bir hata oluştu', [String(err?.stack || err)]);
  }
})();
