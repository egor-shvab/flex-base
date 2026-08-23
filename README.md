# FlexBase

A low-code platform for building simple business applications without writing code. Instead of a
fixed CRM structure, users create their own tables, define custom fields, and manage records through
interfaces generated from that configuration.

The architecture is **metadata-driven**: forms, tables, validation and API contracts are all derived
from field definitions stored in the database — there are no hardcoded business entities. Every
resource belongs to a single authenticated user, and ownership is enforced on the server for every
request.

**Stack:** Nuxt 4 · Vue 3 · TypeScript · Nitro · Prisma 7 · PostgreSQL · Pinia · zod · SCSS

Further reading: [CLAUDE.md](CLAUDE.md) for the project's working rules and conventions,
[docs/architecture.md](docs/architecture.md) for how the metadata layer works,
[docs/styling.md](docs/styling.md) for how the SCSS layer is put together,
[docs/decisions.md](docs/decisions.md) for why it works that way, and
[docs/limitations.md](docs/limitations.md) for what it knowingly does not do.

## Requirements

- Node.js 20+
- Docker (for PostgreSQL)
- npm — this project uses `package-lock.json`; other package managers are not supported

## Setup

```bash
npm install
```

Copy the environment template and fill it in:

```bash
cp .env.example .env
```

| Variable       | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string — matches the `docker-compose.yml` service |
| `JWT_SECRET`   | Secret for signing auth tokens; use a long random string                |

Start PostgreSQL and apply the migrations:

```bash
npm run db:up
```

```bash
npx prisma migrate dev
```

Then run the dev server at http://localhost:3000:

```bash
npm run dev
```

## Commands

| Command                    | Does                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`              | Dev server (no type checking — kept fast)                                     |
| `npm run typecheck`        | `vue-tsc` over the app, then `tsc` over the e2e specs — the inner-loop gate   |
| `npm run build`            | Production build; runs `vue-tsc`, so a type error fails it                    |
| `npm run preview`          | Preview a production build                                                    |
| `npm run test`             | The `unit` + `nuxt` projects — no database, no browser                        |
| `npm run test:unit`        | The `unit` project alone — the fast inner loop                                |
| `npm run test:nuxt`        | The `nuxt` project alone                                                      |
| `npm run test:integration` | The integration suite; starts PostgreSQL first                                |
| `npm run test:e2e`         | Playwright over the production build; installs Chromium and starts PostgreSQL |
| `npm run test:e2e:ui`      | The same, in Playwright's UI mode                                             |
| `npm run test:watch`       | Vitest in watch mode                                                          |
| `npm run test:coverage`    | The merged coverage report; needs a database                                  |
| `npm run lint`             | ESLint                                                                        |
| `npm run format`           | Format everything with Prettier                                               |
| `npm run format:check`     | Check formatting without writing                                              |
| `npm run db:up`            | Start PostgreSQL via Docker Compose                                           |
| `npm run db:studio`        | Browse the database in Prisma Studio                                          |

Database changes go through Prisma:

```bash
npx prisma migrate dev --name <name>
```

`npm install` runs `prisma generate && nuxt prepare` via `postinstall`, so a fresh clone is ready
once `.env` exists.

## Tests

Four projects: `unit` and `nuxt` (no database, both run by `npm run test`), `integration` (against
real PostgreSQL) and `e2e` (Playwright over the production build). `test:integration`, `test:e2e` and
`test:coverage` start PostgreSQL themselves, so they need only Docker running.

`CLAUDE.md` §10 has the rule for which project a new spec belongs in.

## CI

`.github/workflows/ci.yml` runs three jobs on pushes to `main` and `develop`, and on every pull
request:

- **quality** — `format:check` → `lint` → `typecheck` → `test` → `build`. No database service:
  nothing in this job connects to Postgres, and its dummy `DATABASE_URL` exists only so
  `prisma generate` can resolve the datasource variable.
- **integration** — the integration suite against a `postgres:17-alpine` service container, run
  through `coverage:collect` so the merged coverage report can see `server/api/` and
  `server/middleware/`. The report is uploaded as an artefact; there is deliberately no threshold
  gate.
- **e2e** — installs Chromium and runs Playwright against the production build, uploading the
  Playwright report.
