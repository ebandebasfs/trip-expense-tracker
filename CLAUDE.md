# Trip Expense Tracker

Specs: `docs/specs/product.md`, `docs/specs/features/`. Rules: `docs/rules/project-rules.md` (read first).

The app is not scaffolded yet. Paths and scripts below are the target layout.

## Stack
- TypeScript ~6.0 (not 7: ts-jest and the Nest CLI do not support it). Node 22.18+, 24.11+ or 26+. npm workspaces.
- `app/api`: NestJS 12, Prisma 7.10 with SQLite (`@prisma/adapter-better-sqlite3`), Nest `Logger`, Jest 30 + ts-jest.
- `app/web`: Next.js 16 (App Router), React 19, trip pages are client components, Jest 30 + React Testing Library.
- Passwords: `node:crypto` scrypt. Sessions: server-side record, random token in an HttpOnly cookie with no Expires. The DB stores a hash of the token, never the token.
- Web proxies `/api/*` to the API with `next.config` rewrites, so the cookie stays same-origin.

## Layout
- `app/api/src/domain/`: pure TypeScript for splits, balances, suggested payments and validation. No Nest or Prisma imports.
- `app/api/src/<feature>/`: module, controller, service, repository interface and Prisma repository.
- `app/api/prisma/`: schema and migrations. `app/api/prisma.config.ts`.
- `app/web/src/app/`: routes. `app/web/src/components/`: UI. `app/web/src/lib/`: API client and pure helpers.

## Conventions
- Money is integer cents. Writes that change more than one record use one Prisma `$transaction`.
- SQLite has no row locks. The check-then-insert in F6 and the in-use check in F3 start with a write inside the transaction, so SQLite's single-writer lock covers them.
- Services depend on repository interfaces. Unit tests use fakes, with no DB or network.
- Logging: Nest `Logger` in the API. No `console.*` anywhere, and no logging in `app/web`.
- Name each test with its AC ID, for example `it('F3.AC4 ...')`.

## Commands (repo root)
- Install: `npm install`
- Env: copy `app/api/.env.example` to `app/api/.env`. Never commit it.
- Migrate: `npm run db:migrate -w app/api`
- Run API: `npm run dev -w app/api` (port 3001). Run web: `npm run dev -w app/web` (port 3000).
- Test all: `npm test`
- Test one package: `npm test -w app/api` or `npm test -w app/web`
- Test one AC: `npm test --workspaces --if-present -- -t "\bF3\.AC4\b"` (the `\b` stops `F3.AC4` matching `F3.AC40`)
