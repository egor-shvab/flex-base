import { defineVitestConfig } from '@nuxt/test-utils/config'

/**
 * Everything the node project cannot reach: Pinia stores (each calls `useApi()` at setup time,
 * pulling `#imports` into the graph), composables built on `useRoute` or `document`, and
 * components, whose `.vue` files need a Vue plugin.
 *
 * `defineVitestConfig`'s `environment: 'nuxt'` boots the real app from `nuxt.config.ts`, so the
 * aliases, the module list and the Vue/SFC pipeline are the ones the app ships with. Nothing is
 * hand-stubbed — a stub would be a second source of truth able to drift.
 *
 * Specs are colocated and marked by the `*.nuxt.spec.ts` suffix, so the project a file runs in is
 * readable from its name and the node project can exclude it by glob.
 */
export default defineVitestConfig({
  test: {
    name: 'nuxt',
    environment: 'nuxt',
    // Same reasoning as the node project — `types: []` in the generated tsconfigs means ambient
    // `describe`/`it` would not typecheck, so every spec imports them from `vitest`
    globals: false,
    include: ['{app,shared}/**/*.nuxt.spec.ts'],
    environmentOptions: {
      nuxt: {
        // Stated rather than left to default: happy-dom is the lighter of the two, and nothing
        // here needs jsdom's fuller emulation. A real browser stays Playwright's job.
        domEnvironment: 'happy-dom',
      },
    },
  },
})
