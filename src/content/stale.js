var SCC = globalThis.SCC || (globalThis.SCC = {});

// After the extension is reloaded or updated, scripts already running in open
// sahibinden tabs lose their link to it: every chrome.* call throws "Extension
// context invalidated" and the buttons can't do anything until the page reloads.
(() => {
  const NAME = chrome.runtime.getManifest().name; // read now: it throws once the link is gone

  SCC.extensionGone = () => !chrome.runtime?.id;

  const STYLE = `
    :host { all: initial; }
    .note {
      position: fixed; top: 20px; right: 20px; z-index: 2147483647; box-sizing: border-box;
      width: 340px; max-width: calc(100vw - 40px); padding: 14px;
      color: #141414; background: #fff; border: 2px solid #d97706; border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0,0,0,.22); font: 16px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    p { margin: 0 0 12px; }
    button { display: block; width: 100%; min-height: 46px; padding: 10px 14px; cursor: pointer; border: 0; border-radius: 8px;
             font: inherit; font-size: 17px; font-weight: 600; color: #fff; background: #1d5fb8; }
    button:hover { filter: brightness(1.1); }
  `;

  // For click handlers: `if (SCC.staleNotice()) return;`. When the extension is gone,
  // shows a note asking for a page reload and returns true.
  SCC.staleNotice = function () {
    if (!SCC.extensionGone()) return false;
    if (!document.getElementById('scc-stale')) {
      const host = document.createElement('div');
      host.id = 'scc-stale';
      host.attachShadow({ mode: 'open' }).innerHTML = `<style>${STYLE}</style>
        <div class="note" lang="tr" role="alert">
          <p><b>${NAME} güncellendi.</b> Devam etmek için sayfayı yenileyin.</p>
          <button type="button">Sayfayı yenile</button>
        </div>`;
      host.shadowRoot.querySelector('button').onclick = () => location.reload();
      document.body.appendChild(host);
    }
    return true;
  };
})();
