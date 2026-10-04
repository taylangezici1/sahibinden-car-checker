chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'openDashboard') {
    const hash = msg.group ? `#${encodeURIComponent(msg.group)}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard/dashboard.html${hash}`) });
  }
});
