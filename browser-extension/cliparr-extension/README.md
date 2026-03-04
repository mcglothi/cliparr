# Cliparr Browser Extension (MVP)

Cliparr extension gives you a one-click coupon workflow in your normal browser session.

## Why extension mode

- Uses your real logged-in browser profile and cookies.
- Better compatibility with anti-bot protected coupon pages.
- Still provides one control surface for multi-store runs.

## Current status

- Hannaford: automated clipping implemented.
- Shaw's: automated clipping implemented.
- Other configured stores: open coupon pages for manual action.

## Install locally (Chrome)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `browser-extension/cliparr-extension`.

## Use it

1. Log into store websites normally.
2. Open the Cliparr extension popup.
3. Click **Clip Enabled Stores**.
4. Open **Settings** to enable stores and set daily schedule.

## Human checkpoint flow

If a store shows a verification challenge (for example slider/puzzle):

1. Cliparr pauses and keeps that tab open.
2. Popup shows **Human Checkpoint** with actions.
3. Solve challenge in the store tab.
4. Click **Resume** in Cliparr to continue clipping.

## Security notes

- No plaintext credentials are stored by default.
- Runs against your active browser sessions.
- Keep extension installs limited to trusted machines.

## Next build targets

- Per-store plugin SDK for extension scripts.
- Optional backend sync for metrics/history.
- Retry + artifact capture for failed store runs.
