# Cliparr Handoff (2026-03-03)

## Current state

Cliparr is deployed on TrueNAS (Dockge stack) with API, scheduler, worker, web, postgres, and redis.

The project now has two execution paths:

1. Container worker path (control plane, scheduling, history)
2. Browser extension path (real session automation for anti-bot stores)

## What is working

- Core platform: accounts, schedules, runs, insights, run history
- Run diagnostics: explicit error messages and debug artifacts in worker path
- Extension MVP (MV3): popup + settings + schedule + run controls
- Hannaford extension automation:
  - clips coupons
  - handles load-more loops
  - human checkpoint flow for verification challenges
- Shaw's extension automation:
  - active and clipping at least part of the catalog (example run clipped 90)
  - load-more support
  - challenge detection + checkpoint

## Known issues

- Shaw's can still fail to finish full catalogs in some sessions.
- Shaw's occasionally navigates/reloads during automation and can reset the active frame.
- Popup UX and long-run telemetry are improved but still need tighter completion semantics.

## Why this is hard

Store anti-bot behavior and frontend changes create a moving target. A fully unattended container-only strategy is not reliable for protected stores.

## Architecture direction (recommended)

- Keep backend as control plane (configs, schedules, metrics, history)
- Use extension as execution plane for protected stores
- Treat human verification as first-class state, not a failure
- Classify stores by capability tier:
  - Tier A: API-backed automation
  - Tier B: DOM automation with periodic verification
  - Tier C: manual-assist workflow

## Tomorrow's first tasks

1. Stabilize Shaw's completion criteria and avoid premature stop.
2. Add per-run coupon manifest capture (title/offer-id if available) in extension.
3. Add clearer run outcome states in popup: completed, partial, blocked, timed out.
4. Add auto-resume polling after checkpoint solve.
5. Commit and tag extension milestone (`v0.1-extension-mvp`).

## Security and product posture

- Do not automate CAPTCHA or bypass explicit anti-bot controls.
- Keep user accounts and credentials in trusted local/session boundaries.
- Keep transparent logs and conservative defaults.
