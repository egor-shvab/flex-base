# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is a full-stack **low-code platform** built with **Nuxt 4, Vue 3, TypeScript, Nitro, Prisma, and PostgreSQL**. Users build simple business applications **without writing code**: instead of a fixed CRM structure, they create their own tables, define custom fields, and manage records through dynamically generated interfaces.

Two rules are non-negotiable: the architecture is **metadata-driven** — forms, tables, and APIs are generated from configuration stored in the database, never from hardcoded business entities — and every resource belongs to a single authenticated user, with **ownership enforced on the server for every request**.

### Core Principles

- **Metadata-driven architecture** — behavior described by data; no hardcoded business entities, pages, or components.
- **Dynamic UI generation** — forms and tables are generated from field/column definitions, input components are selected automatically by field type, and validation rules are derived from metadata.
- **Generic, reusable code** — components and APIs work with configurable entities; adding a new table type requires no new frontend or backend code.
- **Extensible field system** — new field types plug in without rewrites.
- **Server-enforced security** — authentication and per-user data ownership are checked on every request.
- **Full TypeScript coverage** — with zod schemas shared between client and server.
- **Keep the MVP simple** — design for extensibility, but do not implement future features prematurely; favor clean architecture and maintainability over short-term optimizations.

### MVP Scope

The first version focuses only on the core functionality needed to validate the concept:

- User registration and authentication.
- Per-user data isolation.
- Creating custom tables.
- Creating custom fields for each table.
- Creating, editing, and deleting records (full CRUD).
- Automatically generated forms based on field definitions.
- Automatically generated tables based on field definitions.
- Basic field validation.
- Basic filtering and sorting.
- Relationships between tables.

Everything else — teams, workspaces, permissions, dashboards, activity history, workflows, automations, file uploads, import/export, third-party integrations — is **future functionality**: do not implement it, and do not let it influence the MVP architecture.

## Commands

```bash
npm run dev          # start dev server at http://localhost:3000
npm run build        # production build
npm run generate     # static site generation
npm run preview      # preview a production build locally
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
npx eslint .         # lint
```

Database workflow (applies once `prisma/schema.prisma` exists):

```bash
npx prisma migrate dev --name <name>  # create & apply a migration
npx prisma generate                   # regenerate the Prisma client
npx prisma studio                     # browse data in a GUI
```

There is no test suite configured in this repository yet.

Tooling: Prettier (`.prettierrc`: no semicolons, single quotes, 2-space indent, `printWidth` 100) formats `.vue`, `.ts`, `.js`, `.scss`, `.json`, and `.md` — including SCSS and `<style lang="scss">` blocks natively; build/generated output is excluded via `.prettierignore`. ESLint handles code quality only: `eslint.config.mjs` imports the config generated into `.nuxt/` by `nuxt prepare`/postinstall, with `eslint-config-prettier` appended to disable rules that would conflict with Prettier.

## Environment

Configuration lives in a gitignored `.env` at the repo root (there is no `.env.example` yet):

- `DATABASE_URL` — PostgreSQL connection string used by Prisma.
- `JWT_SECRET` — secret for signing JWTs (planned convention; auth code is not written yet).

`npm install` runs `nuxt prepare` via postinstall, regenerating the `.nuxt/` configs.

## Architecture

This is a full-stack Nuxt 4 application using the `app/` source directory convention (Nuxt 4 default), with the Nitro server layer under `server/`, shared client/server code under `shared/`, and the database layer under `prisma/`. The folder skeleton is scaffolded (empty directories carry `.gitkeep` stubs); most feature files are not written yet.

### Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Pinia (state), SCSS (`sass-embedded`).
- **Backend:** Nitro (Nuxt's server engine) via `server/api` routes.
- **Database:** PostgreSQL through **Prisma** (`@prisma/client` runtime, `prisma` CLI). Schema will live in `prisma/schema.prisma` (not created yet).
- **Auth:** manual — **bcrypt** for password hashing, **jsonwebtoken** (JWT) for tokens. No auth library.
- **Validation:** **zod**, used for shared client + server validation schemas.

### Directory structure

```
app/                         # Nuxt 4 frontend (client)
  assets/scss/               # global SCSS (main.scss + partials)
  components/
    common/                  # generic UI atoms (buttons, modals, …)
    fields/                  # ONE component per field type + a type→component registry
    form/                    # DynamicForm — renders a form from field definitions
    table/                   # DynamicTable + toolbar — renders a table from column definitions
  composables/               # auto-imported composables (useApi, useTables, useRecords, …)
  layouts/                   # default + auth layouts
  middleware/                # route guards (auth)
  pages/                     # file-based routing
    auth/                    # login / register
    tables/[tableId]/records/  # dynamic table & record views
  stores/                    # Pinia stores (auth, tables, records)
server/                      # Nitro backend
  api/                       # HTTP route handlers (thin: parse → check ownership → call service)
    auth/                    # register / login / logout
    tables/[tableId]/fields/    # field-definition CRUD
    tables/[tableId]/records/   # generic record CRUD (filter/sort)
  middleware/                # server middleware (attach authenticated user to event.context)
  services/                  # generic, framework-agnostic business logic (record/query/validation)
  utils/                     # prisma singleton, auth helpers, ownership assertions
  plugins/                   # Nitro plugins
shared/                      # types/constants/schemas used by BOTH client & server
  types/                     # field / table / record TypeScript types
  validation/                # shared zod schemas
prisma/
  migrations/                # Prisma migration history
public/                      # static assets
```

### API conventions

- Route files are named by HTTP method suffix under `server/api/`: `index.get.ts`, `index.post.ts`, `[tableId].patch.ts`, `[tableId].delete.ts`, …
- Handlers stay thin: validate input with the shared zod schema from `shared/validation/` → assert ownership via the `server/utils/` helpers → delegate all business logic to `server/services/`.
- Throw errors with Nitro's `createError({ statusCode, statusMessage })`; never return password hashes or another user's data.
- Server middleware authenticates the request and attaches the user to `event.context`.

### Conventions & notes

- Modules enabled in `nuxt.config.ts`: `@nuxt/eslint`, `@nuxt/fonts`, `@nuxt/icon`, `@nuxt/image`, `@pinia/nuxt`.
- `compatibilityDate` is pinned to `2025-07-15` in `nuxt.config.ts`.
- TypeScript config (`tsconfig.json`) references the project-reference configs generated into `.nuxt/` (`tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.shared.json`, `tsconfig.node.json`) — these are regenerated by `nuxt prepare`, do not edit them directly.
- Follow Nuxt 4 conventions: `app/pages/` for file-based routing, `app/components/` and `app/composables/` auto-imported, `app/stores/` for Pinia; `server/api/` for Nitro route handlers; `shared/` auto-scoped to both client and server.
- **Enforce data ownership through the `server/utils/` helpers** — every table/field/record query (in handlers and services alike) is scoped to the authenticated user.

## Styling

All styles in this project are written in **SCSS**, never plain CSS. `sass-embedded` is installed as the compiler. Global styles live in `app/assets/scss/main.scss` (registered via the `css` array in `nuxt.config.ts`); component styles go in `<style lang="scss" scoped>` blocks.

Rules:

- Always use `.scss` syntax — never plain CSS. Vue SFC style blocks must be `<style lang="scss" scoped>`.
- Follow the **BEM** (Block__Element--Modifier) methodology for class names.
- Use SCSS **nesting with the `&` operator** wherever possible, and never duplicate a parent selector when it can be nested under `&`.
- Use SCSS features (nesting, variables, mixins, functions, `@use`, etc.) to keep styles clean and maintainable.

```scss
.card {
  display: flex;

  &__header {
    padding: 16px;
  }

  &__title {
    font-size: 20px;
  }

  &--active {
    border-color: var(--color-primary);
  }

  &:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  }
}
```

## After making changes

At the end of any task where code has been changed, run the formatter and then the build to verify everything works:

```bash
npm run format  # format all changed code with Prettier
npm run build   # production build — confirm it succeeds
```

Also, at the end of any task, update this `CLAUDE.md` if necessary — whenever the changes introduce new commands, conventions, architecture, or workflows, keep this file in sync so it stays an accurate guide for future work.
