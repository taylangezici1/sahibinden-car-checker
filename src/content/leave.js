var SCC = globalThis.SCC || (globalThis.SCC = {});

// A saved listing someone opened (e.g. from the dashboard) turned out to be taken down:
// close the tab right away, or go back when the tab came from another page. The
// dashboard says what happened (see toastGone in dashboard/dashboard.js). Used on
// listing pages and on the search page sahibinden sends a taken-down listing on to.
SCC.leave = function () {
  if (history.length > 1) history.back();
  else if (!SCC.extensionGone()) chrome.runtime.sendMessage({ type: 'closeTab' }).catch(() => {});
};
