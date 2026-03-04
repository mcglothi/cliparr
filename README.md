# Cliparr

**Cliparr: automated coupon clipping across stores.**

Cliparr is an open-source, plugin-based platform that logs into supported store accounts and clips available digital coupons on a schedule.

## Why Cliparr

- One dashboard for many stores
- Scheduled runs with retry + failure screenshots
- Plugin model so new stores can be added quickly
- Self-hosted, privacy-first deployment

## MVP (v0.1)

- FastAPI control plane (`apps/api`)
- Playwright worker (`apps/worker`)
- APScheduler scheduler (`apps/scheduler`)
- Next.js web UI (`apps/web`)
- Postgres + Redis + Docker Compose
- Plugin SDK with Hannaford starter plugin
- Ansible playbooks for TrueNAS + Pi-hole + Nginx Proxy Manager

## Security posture

- Secrets loaded from environment / secret manager only
- No plaintext secrets in repo
- Non-root containers where possible
- Strict CORS / trusted origins configuration
- Run audit logging without credential values
- Security policy and disclosure process included

## Quick start

```bash
cp .env.example .env
docker compose -f ops/compose/docker-compose.yml up -d --build
```

Web UI: `http://localhost:3000`
API docs: `http://localhost:8000/docs`

## TrueNAS deployment

Use the included Ansible playbooks in `ops/ansible` to:

- Add DNS record in Pi-hole
- Configure Nginx Proxy Manager host
- Attach wildcard cert + HTTPS redirect

## Store support status (MVP)

- Hannaford: extension automation working (with checkpoint flow)
- Shaws: extension automation in active tuning (partial success)
- Other stores: plugin request workflow in docs

## Browser extension MVP

For anti-bot protected stores, run Cliparr in your normal browser session via the MV3 extension:

- Source: `browser-extension/cliparr-extension`
- Install/use guide: `browser-extension/cliparr-extension/README.md`
- Current status / handoff: `docs/HANDOFF.md`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/PLUGIN_SDK.md](./docs/PLUGIN_SDK.md).

## Legal and ethics

Cliparr is intended for personal account automation where permitted by each store's terms. Users are responsible for complying with store terms, local laws, and account security requirements.
