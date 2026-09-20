# Clipper PWA

An iPhone-first progressive web app for a low-manual-work meme clipping workflow.

## Included
- Inspiration account pool
- Local video import
- Random 10 unused clips
- Persistent used/unused tracking
- Meme hook generation with six styles
- Caption generation
- Batch state / ready state
- iPhone PWA manifest + service worker
- Local-first storage

## Important limitation
A normal web app cannot legitimately fetch arbitrary Instagram Reel source files from any public username. This build therefore does not pretend to scrape Instagram. Import clips from Photos/Files or a legitimate source integration, then use the Clipper workflow.

## Put it online for free
Upload this folder to any HTTPS static host (for example a static-site host). Once it has an HTTPS URL, open it in Safari on iPhone, tap Share -> Add to Home Screen -> enable Open as Web App -> Add. Apple documents this installation flow here: https://support.apple.com/guide/iphone/iphea86e5236/ios

## AI upgrade
The current remix engine is deterministic/local so the PWA works without an API key. A secure backend can replace `makeHook()` and `makeCaption()` with an LLM service without exposing a secret API key in the browser.
