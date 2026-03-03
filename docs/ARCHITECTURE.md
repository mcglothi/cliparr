# Architecture

## Services

- `web` (Next.js): operator dashboard
- `api` (FastAPI): account/store/run management
- `scheduler` (APScheduler): periodic job enqueueing
- `worker` (Playwright): browser automation execution
- `postgres`: durable state
- `redis`: job queue

## Data flow

1. Scheduler pushes run jobs into Redis.
2. Worker consumes jobs and executes plugin automation.
3. Worker posts run status to API.
4. API stores run history in Postgres.
5. Web reads API for status and run metrics.

## Security boundaries

- API never returns encrypted secrets.
- Worker receives credentials only for active run context.
- Network ingress is limited to `web` and `api`.
- TLS termination is handled at reverse proxy (NPM/Caddy/Traefik).

## Future hardening

- Encrypted secret storage in dedicated secrets manager (Vault/SOPS)
- Per-store headless browser container isolation
- MFA challenge handoff workflow
- OIDC auth for admin UI
