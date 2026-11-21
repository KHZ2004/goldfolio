# Publish the actual app at khz2004.github.io/goldfolio/

The `docs/` folder is the ready-to-host GitHub Pages app. It includes `index.html`, relative asset URLs, browser storage, and a scoped service worker for `/goldfolio/`. It works without the Node server.

1. Extract `goldfolio-github-pages.zip` on your computer. Open its extracted folder.
2. In the GitHub repository, use **Add file > Upload files**. Upload the extracted contents (including `docs`, `public`, `pages`, `scripts`, and `.github`) at the repository root. Do not upload the ZIP itself or an enclosing folder. Commit the upload to `main`.
3. Open **Settings > Pages > Build and deployment > Source** and select **GitHub Actions**.
4. Open **Actions > Publish Goldfolio > Run workflow**, select `main`, and run it. Wait for the green successful deployment. The workflow needs Actions enabled and the repository public for the free setup.
5. Visit https://khz2004.github.io/goldfolio/ and reload it. It will open the app directly rather than rendering the README.

If uploading `.github` as a folder is inconvenient, choose **Add file > Create new file**, enter `.github/workflows/pages.yml` as the filename, paste the contents of the supplied `pages.yml`, and commit it. This file enables automatic publishing and scheduled price updates.

## What changes in the free Pages version

- Purchases and targets live in each visitor's browser, never in the repository. Use Export backup / Import backup to transfer purchases from the local app. Changing browsers, devices, or clearing site data otherwise starts a new portfolio.
- The public price API does not permit browser requests from github.io. GitHub Actions fetches the data and publishes only public market data as `market.json`.
- The workflow runs on pushes, manual requests and an approximately 15-minute schedule. GitHub may delay scheduled runs. The displayed quote timestamp is authoritative. Refresh fetches the latest published snapshot, not an on-demand request to HargaEmas.
- The chart and headline use HargaEmas sell reference; portfolio valuations use its buyback reference. All prices are already in RM per gram.
- Targets are checked while the app is open using recent published quotes. There are no background push notifications without a backend. The alert UI states this limitation.
- The workflow keeps prior public quote observations from the previous deployment. This gradually collects intraday history. HargaEmas does not expose past intraday data, so this conversion does not backfill a full 24-hour curve immediately.
- No personal server data, push keys, device identifiers, or node_modules are in this upload package.

## Rebuild after changing app source

Run `node scripts/build-pages.mjs` and `node scripts/update-pages-market.mjs`. The workflow runs both commands on GitHub; local Node installation is not required for uploading and deploying the supplied files.

For an immediate manual preview without Actions, publish `main /docs` in Pages settings. This serves the app but prices stay at the included snapshot until rebuilt. Select GitHub Actions for scheduled price updates.
