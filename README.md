# FlexBase

A low-code platform for building simple business applications without writing code. Instead of a
fixed CRM structure, users create their own tables, define custom fields, and manage records through
interfaces generated from that configuration.

The architecture is **metadata-driven**: forms, tables, validation and API contracts are all derived
from field definitions stored in the database — there are no hardcoded business entities. Every
resource belongs to a single authenticated user, and ownership is enforced on the server for every
request.

**Stack:** Nuxt 4 · Vue 3 · TypeScript · Nitro · Prisma 7 · PostgreSQL · Pinia · zod · SCSS

See [CLAUDE.md](CLAUDE.md) for the full architecture reference.

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

| Command                | Does                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Dev server (no type checking — kept fast)                  |
| `npm run typecheck`    | `vue-tsc` only — the fast inner-loop type gate             |
| `npm run build`        | Production build; runs `vue-tsc`, so a type error fails it |
| `npm run preview`      | Preview a production build                                 |
| `npm run lint`         | ESLint                                                     |
| `npm run format`       | Format everything with Prettier                            |
| `npm run format:check` | Check formatting without writing                           |
| `npm run db:up`        | Start PostgreSQL via Docker Compose                        |
| `npm run db:studio`    | Browse the database in Prisma Studio                       |

Database changes go through Prisma:

```bash
npx prisma migrate dev --name <name>
```

`npm install` runs `prisma generate && nuxt prepare` via `postinstall`, so a fresh clone is ready
once `.env` exists.

## CI

`.github/workflows/ci.yml` runs `format:check` → `lint` → `typecheck` → `build` on pushes to `main`
and `develop`, and on every pull request. There is no database service in CI: nothing in the build
connects to Postgres, and the dummy `DATABASE_URL` exists only so `prisma generate` can resolve its
datasource variable.

There is no test suite yet. Vitest (for the URL codec, the SQL builder and the zod schemas) and
Playwright (for the auth-gated pages) are the intended additions once the MVP settles.
