var SCC = globalThis.SCC || (globalThis.SCC = {});

// A saved listing someone opened (e.g. from the dashboard) turned out to be taken down:
// say so, then close the tab, or go back when the tab came from another page, unless
// the reader chooses to stay. Used on listing pages and on the search page sahibinden
// sends a taken-down listing on to.
(() => {
  const LEAVE_MS = 5000;
  const STYLE = `
    :host { all: initial; }
    .note {
      position: fixed; top: 20px; right: 20px; z-index: 2147483647; box-sizing: border-box;
      width: 360px; max-width: calc(100vw - 40px); padding: 14px;
      color: #141414; background: #fff; border: 2px solid #9bd3ad; border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0,0,0,.22); font: 16px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    p { margin: 0 0 10px; }
    button { display: block; width: 100%; min-height: 46px; padding: 10px 14px; cursor: pointer; border-radius: 8px;
             font: inherit; font-size: 17px; font-weight: 600; color: #141414; background: #fff; border: 1px solid #d6d4cc; }
    button:hover { border-color: #1d5fb8; }
  `;

  SCC.leaveSoon = function () {
    const back = history.length > 1;
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = `<style>${STYLE}</style>
      <div class="note" lang="tr" role="status">
        <p><b>Bu ilan yayından kalkmış.</b> Kaydedilen ilanlarınızda "yayından kalktı" diye işaretlendi,
          fiyat karşılaştırmasına artık katılmaz.</p>
        <p>${back ? 'Birkaç saniye içinde önceki sayfaya dönülecek.' : 'Bu sekme birkaç saniye içinde kapanacak.'}</p>
        <button type="button">Bu sayfada kal</button>
      </div>`;
    document.body.appendChild(host);
    const timer = setTimeout(() => {
      if (back) history.back();
      else if (!SCC.extensionGone()) chrome.runtime.sendMessage({ type: 'closeTab' }).catch(() => {});
    }, LEAVE_MS);
    host.shadowRoot.querySelector('button').onclick = () => {
      clearTimeout(timer);
      host.remove();
    };
  };
})();
