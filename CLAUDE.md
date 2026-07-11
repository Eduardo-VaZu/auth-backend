# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The workspace-level `../CLAUDE.md` covers the monorepo layout and how `auth-backend` fits alongside `auth-frontend` and `selenium-tests`. This file adds the auth-backend–specific detail that isn't obvious from reading a single file.

## Commands

Everything runs from `auth-backend/`. Full script list is in `package.json`; the frequently-used ones:

```bash
npm run dev                 # nodemon on :4000
npm run dev:local           # docker:up:d then dev
npm run build               # tsc -> dist/
npm run start               # node dist/main/server.js

npm run type:check          # tsc --noEmit
npm run lint                # eslint .
npm run format              # prettier --write .

npm run db:migrate          # drizzle-kit migrate
npm run db:generate         # build + drizzle-kit generate
npm run db:seed:roles       # tsx seed-roles.ts
npm run db:migrate:legacy-credentials  # one-off tsx data-migration.ts
npm run db:studio           # drizzle-kit studio

npm run test                # vitest run (both projects)
npm run test:unit           # vitest --project unit
npm run test:integration    # vitest --project integration  (needs Docker: postgres+redis)
npm run test:coverage       # unit-only, applies thresholds
npm run pr:check            # type:check + lint + test:ci — run before opening a PR

npm run docker:up:d         # postgres + redis, detached
npm run docker:up:full      # full stack with `fullstack` profile
npm run docker:down         # tear down + remove volumes
```

Running a single test file: `npx vitest run tests/modules/access/application/unit/LoginUseCase.test.ts`.
Filter by test name: `npx vitest run -t "login rejects invalid password"`.
Watch mode: `npm run test:watch`.

## Test project split (`vitest.config.mts`)

Two Vitest projects share `tests/setup.ts` (which fills fallback env vars so unit tests never touch a real service):

- **unit** — `tests/**/unit/**/*.test.ts`, node env, parallel.
- **integration** — `tests/**/integration/**/*.test.ts`, serial (`fileParallelism: false`), 120 s timeout, uses `@testcontainers/postgresql` + Testcontainers Redis. Docker must be running.

Coverage (unit only) is enforced globally at 45% lines/statements, 40% branches/functions, with stricter **90%** gates on `src/modules/identity/domain/**` and `src/modules/access/domain/**`. Adding domain logic without tests will break `test:coverage`.

Excluded from coverage: `src/main/**`, `src/config/**`, `src/types/**`, `src/infrastructure/db/migrations/**`, `**/*.d.ts`.

## Architecture

Layered, DDD-style modules wired through Inversify with a manual configure-per-module pattern.

**Module layout.** Each `src/modules/<name>/` owns:
- `domain/` — entities, repository interfaces, domain services (pure — no framework imports).
- `application/` — use cases, DTOs, constants, small utils.
- `infrastructure/` — Drizzle repositories, Express controllers, Zod-validated routes, external services.
- `<name>.module.ts` — exports `configure<Name>Module(container)` that binds symbols from `TYPES`.

Modules under `src/modules/`: `health`, `identity` (register + profile), `access` (login, refresh, list/revoke sessions, logout), `credentials` (verify email, forgot/reset password, change email/password), `admin` (users + roles), `audit` (auth-event queries).

**Composition root.** `src/container/inversify.config.ts` builds a Singleton-default container, binds global infra (`Logger`, `DbPool`, `RedisClient`), binds `IAuthUnitOfWork` from `src/shared/`, then calls each module's `configure*` function. All DI symbols live in `src/container/types.ts` — add new symbols there.

**Request pipeline** (`src/app.ts`, order-sensitive):
1. `requestLogger` (Pino).
2. `/health` router — mounted **before** `express.json()` so health probes don't parse bodies.
3. `express.json({ limit: '10kb' })`.
4. CORS with an allow-list from `env.CORS_ORIGIN` (throws `ForbiddenError` on disallowed origin).
5. Helmet.
6. `cookie-parser` signed with `env.COOKIE_SECRET`.
7. Redis-backed `express-rate-limit` (100 req / 15 min / IP, throws `TooManyRequestsError`).
8. Module routers.
9. 404 → `NotFoundError`.
10. `createErrorHandler(logger)`.

**All auth routers mount under `/auth`** for Postman-v1 compatibility, even though they come from four separate modules (`identity`, `credentials`, `access`). Admin/audit mount under `/admin`. Don't split them apart without coordinating with the API contract.

**Persistence.** `src/infrastructure/db/db.ts` builds the pg pool from `env`; Drizzle schema lives in `src/infrastructure/db/schema/*.ts` and is exported via `schema/index.ts`. Redis client in `src/infrastructure/redis.ts`. Repositories in each module talk Drizzle — they never bypass to raw `pg`.

**Unit of work.** `src/shared/infrastructure/services/AuthUnitOfWork.ts` is bound as `IAuthUnitOfWork` and wraps multi-repo writes in a single transaction. Use it whenever a use case mutates more than one aggregate (session + audit log, credentials + tokens, etc.) — don't call repositories individually in a "then" chain.

**Cron.** `src/cron/cleanup.cron.ts` is started in `src/main/server.ts` and stopped during graceful shutdown. Extend `startCleanupCron`/`stopCronJobs` when adding a new job — don't spawn cron elsewhere.

**Graceful shutdown.** `server.ts` handles SIGINT/SIGTERM: stop accepting connections → stop cron → close pg pool → disconnect Redis, all under `env.SHUTDOWN_TIMEOUT_MS` (default 10 s), with a `process.exit(1)` fallback. New shutdown-sensitive resources go into this sequence.

## Env & runtime rules

- Config lives in `src/config/env.ts` and is validated with Zod at import time. **Startup dies before `main` runs if a var is missing or malformed**, including cross-field rules:
  - `NODE_ENV=production` requires `EMAIL_DELIVERY_MODE=brevo`.
  - `EMAIL_DELIVERY_MODE=brevo` requires `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`.
  - All three secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET`) must be ≥ 32 chars.
- In `preview` mode (dev/test with `EMAIL_DELIVERY_MODE=preview`), some endpoints return a `previewToken` in the response body. **The Selenium suite depends on this** — do not gate it behind a flag or remove it without updating `selenium-tests`.
- TypeScript is `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` + `experimentalDecorators` (Inversify). NodeNext ESM — **all internal imports use the `.js` extension** even when the source file is `.ts`. `@/*` maps to `src/*` (used by tests; source uses relative paths).
- ESLint enforces `no-console`, `@typescript-eslint/consistent-type-imports`, `no-explicit-any`, and `no-floating-promises` on source. `tests/**` relaxes the type-aware rules — don't copy test-file laxity into `src/`.
- Logging is Pino (`src/shared/logger`). Never `console.log`; use the injected `Logger`.

## Security-relevant behaviors (don't regress these)

- Registration never auto-logs-in — email verification is a hard prerequisite.
- `POST /auth/logout` is intentionally **public and idempotent** — no auth middleware, always returns success.
- Refresh tokens rotate on every use, and reuse detection triggers defensive invalidation of the whole session family.
- Credential changes (password, email) invalidate other sessions when appropriate; use `IAuthUnitOfWork` to keep audit + session-invalidation atomic with the credential write.
- Auth-event auditing goes through `IAuthAuditService` — don't write to `auth_audit_logs` directly from a use case.
- Rate limiting is Redis-backed; if you skip the middleware (e.g. for a public endpoint), do it explicitly and document why.

## Testing conventions

- Unit tests mock repositories and services; they must not require Docker. `tests/setup.ts` provides safe fallback env values, so a test that hits a real DB is a bug in the test.
- Integration tests use Testcontainers — they own their own pg + Redis lifecycles; don't share state across files (that's why `fileParallelism: false`).
- HTTP integration uses `supertest` against `createApp(container)` — build a fresh container per test suite when you need clean state.
- Use `npx vitest run <path>` to iterate on a single file; use `-t "<name>"` to filter by test name. `test:watch` for feedback while writing.

## Contributing checklist

Before opening a PR, run:

```bash
npm run pr:check   # type:check + lint + test:ci
npm run build      # optional but catches emit-only issues
```

Open PRs against `main` using `.github/pull_request_template.md`.
