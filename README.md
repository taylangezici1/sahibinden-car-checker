# Sahibinden Car Checker

Personal Chrome extension for finding underpriced used Renault Clios on sahibinden.com.

Every car gets a quality score (penalty points per defect), then a straight line
`price = slope * score + intercept` is fitted over all eligible cars, the same
approach as `cheapest-nft/charting.py`. A car below the line is cheap for its score.

## How it works

1. Browse Clio listings on sahibinden.com. Each listing page you open is parsed
   and saved locally (`chrome.storage.local`), and a panel shows its score,
   the score breakdown and, once enough cars are saved, how far it is from the expected price.
2. The dashboard (popup → "Dashboard'u aç") shows the price/score scatter, the fitted
   line, and all cars ranked from best to worst deal. Export to CSV or back up as JSON.

## Layout

- `src/lib/config.js`: filters (year, trims, no değişen, no heavy damage) and scoring weights. Edit this to tune.
- `src/lib/scoring.js`: filters + score breakdown for one listing
- `src/lib/regression.js`: least-squares fit and price difference per car
- `src/content/parser.js`: reads a listing page (info table, price, boya/değişen, tramer)
- `src/content/panel.js`: on-page panel
- `dashboard/`: chart and tables

Listings are stored raw, so changing `config.js` re-scores everything already saved.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. After editing code, click the reload icon on the extension card and refresh the sahibinden tab
