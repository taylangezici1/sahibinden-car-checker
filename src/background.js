chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'openDashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  }
});
