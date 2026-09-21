CLIPPER V2

This build replaces the old token blur/focus save behavior with an explicit SAVE & TEST CONNECTION button.

GitHub Pages:
1. Upload index.html to the repository (or replace the existing index.html).
2. Commit/push.
3. Wait for GitHub Pages to redeploy.
4. Hard-refresh the page (Ctrl+F5 on Windows).

The Apify token is stored in browser localStorage and tested against Apify's users/me endpoint. The app does not send the token anywhere else.

Note: this package is the token/settings fix and UI foundation; it does not implement unauthorized Instagram downloading/scraping. Media ingestion should use an authorized/legitimate source.
