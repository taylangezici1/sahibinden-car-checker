# Oto Fiyat Rehberi

Personal Chrome extension for finding underpriced used cars on sahibinden.com.
The UI is in plain Turkish with large text, written for a non-technical reader.

Every car gets a quality score (penalty points per defect), then a straight line
`price = slope * score + intercept` is fitted over the eligible cars of the same
model, the same approach as `cheapest-nft/charting.py`. A car below the line is
cheap for its score. Models are grouped by sahibinden's "Marka Seri"
(e.g. "Renault Clio", "Hyundai i20") and never compared with each other.

## How it works

1. Browse car listings on sahibinden.com. Each listing page you open is parsed
   and saved locally (`chrome.storage.local`), and a panel shows its score,
   the score breakdown and, once enough cars of that model are saved, how far it
   is from the expected price.
   On search results pages (`src/content/results.js`) a box offers "Hepsini kaydet"
   for every car on the page, and each car gets its own "Kaydet" button that also
   shows its score and verdict once saved. Saving fetches the listing page in the
   background and runs the same parser, so nothing has to be opened. Requests go
   out one at a time, 1–2 s apart; a 403/429 or three unreadable pages in a row
   stop the run so sahibinden's bot protection isn't provoked.
2. The dashboard (popup → "Kaydedilen ilanları karşılaştır", or the panel's big blue button)
   shows one model at a time: the price/score scatter, the fitted line, and its
   cars ranked from best to worst deal. Export that model to CSV or back up everything as JSON.

## Layout

- `src/lib/config.js`: shared filters and scoring weights, plus per-model profiles
  (`models`: allowed trims, trim points, minimum year...). Edit this to tune.
- `src/lib/scoring.js`: filters + score breakdown for one listing
- `src/lib/regression.js`: least-squares fit and price difference per car
- `src/content/parser.js`: reads a listing page (info table, price, boya/değişen, tramer)
- `src/content/panel.js`: on-page panel
- `dashboard/`: chart, tables and the settings form (`settings.js`)
- `icons/logo.svg`: the logo; `icon-*.png` are renders of it (16/32/48/128). The panel inlines the same SVG.

The display name lives only in `manifest.json` (`name`); the panel, popup and dashboard read it from there.

Listings are stored raw, so changing `config.js` re-scores everything already saved.

`config.js` holds the recommended defaults. The dashboard's "Puan ayarları" form
lets the user change the scoring weights; only the values that differ from
`config.js` are saved (`chrome.storage.local` → `settings`) and laid over it in
every page (`SCC.storage.loadSettings()`), so later edits to `config.js` still
reach anything the user did not touch.

Values typed in on the listing panel (currently only tramer) are stored as
`listing.overrides` and win over what the parser reads, also on later visits.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. After editing code, click the reload icon on the extension card and refresh the sahibinden tab
