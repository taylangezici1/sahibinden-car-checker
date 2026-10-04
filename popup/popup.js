(async () => {
  document.getElementById('name').textContent = chrome.runtime.getManifest().name;
  await SCC.storage.loadSettings();
  const groups = SCC.analyze(await SCC.storage.list());
  const listings = groups.reduce((n, g) => n + g.rows.length, 0);
  const eligible = groups.reduce((n, g) => n + g.eligible.length, 0);
  document.getElementById('summary').textContent = listings
    ? `${listings} ilan kaydedildi (${groups.length} model). Bunların ${eligible} tanesi aradığınız özelliklere uyuyor.`
    : 'Henüz kaydedilmiş ilan yok.';
  document.getElementById('open').onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    window.close();
  };
})();
