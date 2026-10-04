(async () => {
  const analysis = SCC.analyze(await SCC.storage.list());
  document.getElementById('summary').textContent =
    `${analysis.rows.length} ilan kayıtlı, ${analysis.eligible.length} tanesi kriterlere uygun.`;
  document.getElementById('open').onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    window.close();
  };
})();
