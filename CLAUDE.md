# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is a full-stack **low-code platform** built with **Nuxt 4, Vue 3, TypeScript, Nitro, Prisma, and PostgreSQL**.

The goal is a flexible system where users build simple business applications **without writing code**. Instead of a fixed CRM structure, users create their own tables, define custom fields, and manage records through dynamically generated interfaces.

The architecture is **metadata-driven**: the application generates forms and tables from stored configuration rather than from hardcoded components. Avoid hardcoded business entities — every table, field, form, and record is driven by metadata stored in the database.

Every resource belongs to a single authenticated user, and users cannot access data created by other users. Authentication and data ownership must be enforced on the server for every request.

### Core Principles

- **Metadata-driven architecture** — behavior described by data, not hardcoded.
- **Dynamic UI generation** — forms and tables built from field/column definitions.
- **Generic, reusable components** — no business-specific pages or components.
- **Extensible field system** — new field types plug in without rewrites.
- **API-first design** — generic APIs over configurable entities, not predefined models.
- **Full TypeScript coverage.**

### MVP Scope

The first version focuses only on the core functionality needed to validate the concept. Anything outside this scope is **future functionality** and must not influence the initial architecture.

The MVP supports:

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

### Frontend Philosophy

Frontend components should be generic wherever possible — forms generated from field definitions, tables generated from column definitions, input components selected automatically by field type, and validation rules generated from metadata. Avoid business-specific pages or components.

### Backend Philosophy

The backend exposes generic APIs that work with configurable entities rather than predefined business models. Business logic stays generic and reusable, so adding a new table type never requires backend code changes. Authentication and data ownership are enforced on the server for every request.

### Long-Term Vision

Although the MVP is intentionally small, design for future extensibility. Later versions may add teams, workspaces, permissions, dashboards, activity history, workflows, automations, file uploads, import/export, and third-party integrations — but **do not implement these until the MVP is complete**.

### Development Guidelines

- Prefer generic, configurable solutions over business-specific implementations.
- Build reusable components instead of one-off features.
- Avoid hardcoded business logic whenever metadata can describe the behavior.
- Keep the MVP simple; do not implement future features prematurely.
- Favor clean architecture, maintainability, and extensibility over short-term optimizations.

## Commands

```bash
npm run dev       # start dev server at http://localhost:3000
npm run build     # production build
npm run generate  # static site generation
npm run preview   # preview a production build locally
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
```

There is no test suite configured in this repository yet.

Linting is provided by `@nuxt/eslint` via `eslint.config.mjs`, which imports the generated config from `.nuxt/eslint.config.mjs` (created by `nuxt prepare`/`postinstall`). Run `npx eslint .` to lint.

Formatting is handled by **Prettier** (`.prettierrc`): no semicolons, single quotes, 2-space indent, `printWidth` 100 — matching the existing Nuxt code style. ESLint handles code quality only; `eslint-config-prettier` is appended in `eslint.config.mjs` to disable ESLint rules that would conflict with Prettier. Prettier formats `.vue`, `.ts`, `.js`, `.scss`, `.json`, and `.md` (SCSS and `<style lang="scss">` blocks natively — no extra plugin). Build/generated output is excluded via `.prettierignore`.

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

### Conventions & notes

- Modules enabled in `nuxt.config.ts`: `@nuxt/eslint`, `@nuxt/fonts`, `@nuxt/icon`, `@nuxt/image`, `@pinia/nuxt`.
- `compatibilityDate` is pinned to `2025-07-15` in `nuxt.config.ts`.
- TypeScript config (`tsconfig.json`) references the project-reference configs generated into `.nuxt/` (`tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.shared.json`, `tsconfig.node.json`) — these are regenerated by `nuxt prepare`, do not edit them directly.
- Follow Nuxt 4 conventions: `app/pages/` for file-based routing, `app/components/` auto-imported, `app/composables/` auto-imported, `app/stores/` for Pinia; `server/api/` for Nitro route handlers; `shared/` auto-scoped to both client and server.
- **Keep API route handlers thin** — request handlers under `server/api/` should parse input, assert ownership, and delegate to `server/services/`. Generic business logic belongs in services so adding a new table type never requires new backend code (per the metadata-driven philosophy above).
- **Enforce data ownership on every request** through the helpers in `server/utils/` — every table/field/record query is scoped to the authenticated user.

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
npm run format   # format all changed code with Prettier
npm run build     # production build — confirm it succeeds
```

Also, at the end of any task, update this `CLAUDE.md` if necessary — whenever the changes introduce new commands, conventions, architecture, or workflows, keep this file in sync so it stays an accurate guide for future work.
