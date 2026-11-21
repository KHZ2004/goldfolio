# Goldfolio

A phone-friendly, installable gold portfolio app in Malaysian Ringgit. Three tabs: portfolio, gold chart, and price alerts.

## Run on this computer

Open PowerShell in this folder and run:

```powershell
.\Start-Goldfolio.ps1
```

Then open http://localhost:3000. Keep the process running. Dependencies have been installed in this workspace. On another computer, install Node.js 22 or newer, run `npm ci`, then `npm start`.

## Use on your phone

Host the Node app on an always-on server with **HTTPS**, a persistent disk for `data/`, and a process manager that restarts it. Run `npm ci` and `npm start`; the server listens on `PORT` (default 3000). A static-only host cannot run the price polling or push delivery. This project has not been deployed.

Configure a reverse proxy to forward the original Host and `X-Forwarded-Proto: https`. Set `VAPID_SUBJECT` to an HTTPS contact URL or a `mailto:` address you own. Optionally set `DATA_DIR` to the persistent data directory. Never publish the contents of `data/`.

Open your HTTPS address on the phone. On Android, choose Install app / Add to Home screen in the browser menu. On iPhone with iOS 16.4 or later, use Safari → Share → Add to Home Screen, then open the installed app. Go to Price alerts, tap Enable notifications, allow permission, and Send test. Create targets in **RM per gram**. Background delivery is subject to phone notification settings and network access.

The app checks once every two minutes while the server runs, including when the browser is closed. Alerts are inclusive (at or above / at or below), trigger once, and retry failed push delivery for up to an hour. A push service accepting a message does not guarantee delivery to a device. HargaEmas quotes marked stale or older than 15 minutes do not trigger alerts. No phone delivery has been verified yet; use Send test after deployment.

## Prices and chart

- All market data now comes from HargaEmas.my. Live: https://api.hargaemas.my/prices. Its official website proxy is a fallback: https://www.hargaemas.my/api/gold-prices.json.
- Current fields spotSellRmPerKg and spotBuyRmPerKg are divided by 1000. No USD price or separate FX service is used.
- The headline, charts and alerts use the sell reference. Current portfolio value and gain/loss use the buyback reference (spotBuyRmPerKg / 1000). These are market references, not guaranteed execution prices from your online gold platform.
- Current quotes are polled every two minutes, respecting the website proxy's roughly 120-second cache. isStale and lastUpdate are both checked. Stale or older-than-15-minute quotes remain visible with their timestamp and do not trigger alerts.
- Historical daily reference prices use https://www.hargaemas.my/api/gold-prices-graph.json, the feed used by their own public chart. Prices are already RM per gram. Currently about two years are available, covering 1W, 1M and 1Y. 5Y remains disabled. This website feed is not documented as a stable API and may change; errors retain the last saved history and are shown in the app.
- Daily points have date precision and are labelled daily references when inspected. They are not fabricated intraday ticks or guaranteed closing prices. 1D collects actual HargaEmas quote timestamps while the server runs and displays a single dot until more points arrive.
- Historical data is cached six hours with retries every 15 minutes. Every period displays the same latest sell-reference heading.
- Old market caches are discarded to avoid mixing incompatible reference prices. Purchases and alerts are preserved. Existing alert targets now apply to the HargaEmas sell reference.

## Your records

Enter each purchase weight, **total paid in RM**, and optional description. There is no date field. Existing per-gram purchases remain supported and retain their original cost. The app calculates weighted average cost, total invested, current value, and unrealised gain/loss. Use Edit on any purchase to update its grams, total paid and description. The portfolio totals recalculate after saving. Export backup downloads purchases and alert records as JSON.

Records and push subscriptions are kept in `data/store.json`, VAPID keys in `data/vapid.json`. Writes use an atomic rename; run only one server instance. Back up the entire data directory. The browser holds a random device key in local storage. Clearing browser storage or changing device creates a separate portfolio; there is no account login, cross-device sync, or backup-import screen. Exported JSON is for manual recovery. Keep the same browser profile and server address.

The device key acts as an unguessable access token. This is a personal, single-server application, not a hardened public multi-user service. Put a personal deployment behind HTTPS and an access gateway if exposing it on the internet. API data is never cached by the service worker; offline mode can open the app shell but requires the server to load records and prices.

## Verification

`npm test` covers weighted cost, profit/loss, missing prices, inclusive alert crossings, and troy-ounce conversion. Phone push delivery must be tested on the installed app after HTTPS hosting. The server cannot send notifications while stopped or asleep.

Verified locally: real quote and FX retrieval, all seven calculation/history tests, JavaScript syntax checks, mobile browser purchase creation/deletion, alert creation/deletion, and no horizontal overflow at 390px. Browser smoke tests reported no JavaScript errors. Preview images contain temporary test purchases, which were deleted after verification.
