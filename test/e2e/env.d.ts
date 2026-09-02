/**
 * `import.meta.dev` is declared by Nuxt's generated types, which this project's standalone
 * tsconfig does not pull in — it exists so Playwright can resolve `#server`/`#shared`, not to
 * re-create the app's type environment. Declared here so `server/utils/prisma.ts` typechecks
 * when it is reached through a seed helper.
 */
interface ImportMeta {
  readonly dev?: boolean
}
