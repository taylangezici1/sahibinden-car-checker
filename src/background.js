// Tabs opened by "Kaydet" on a results page, waiting for the listing's content script
// to report back: tabId -> settle(status).
const pending = new Map();
const TAB_TIMEOUT_MS = 30000;
const LISTING_URL = /^https:\/\/www\.sahibinden\.com\/ilan\//;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'openDashboard') {
    const hash = msg.group ? `#${encodeURIComponent(msg.group)}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard/dashboard.html${hash}`) });
  }
  if (msg?.type === 'saveViaTab') {
    saveViaTab(msg.url, sender.tab).then(sendResponse);
    return true; // answer comes later
  }
  if (msg?.type === 'listingDone' && sender.tab) pending.get(sender.tab.id)?.(msg.status);
});

chrome.tabs.onRemoved.addListener((tabId) => pending.get(tabId)?.('closed'));

// Saves a listing the way a person would: open it in a background tab next to the
// results page, let content.js read and save it, close the tab. sahibinden banned
// plain fetches of listing pages, which skip everything a real visit runs.
// Resolves to { status }: 'ok' | 'gone' | 'unreadable' | 'botcheck' | 'timeout' | 'closed'.
async function saveViaTab(url, opener) {
  const tab = await chrome.tabs.create({
    url,
    active: false,
    ...(opener && { openerTabId: opener.id, index: opener.index + 1 }),
  });
  let status = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), TAB_TIMEOUT_MS);
    pending.set(tab.id, (s) => {
      clearTimeout(timer);
      resolve(s);
    });
  });
  pending.delete(tab.id);
  if (status === 'closed') return { status };

  // No word from the listing page: if the tab was sent somewhere else, that's a check page.
  if (status === 'timeout') {
    const now = await chrome.tabs.get(tab.id).catch(() => null);
    if (now && !LISTING_URL.test(now.url || now.pendingUrl || '')) status = 'botcheck';
  }
  // A verification page stays open and comes to the front so it can be solved there.
  if (status === 'botcheck') await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  else await chrome.tabs.remove(tab.id).catch(() => {});
  return { status };
}
