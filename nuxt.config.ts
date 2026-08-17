// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
    },
  },

  css: ['~/assets/scss/main.scss'],

  // `extensions` is not cosmetic: the scanner defaults to every builder extension, so a `.ts`
  // file living beside its component — a component-private composable, a spec's shared rig —
  // is registered as a global component of its own (`UseSelectOptions`, `SelectHarness`).
  // Every component here is a `.vue` file, so say that.
  components: [{ path: '~/components', pathPrefix: false, extensions: ['.vue'] }],

  // Components stay auto-imported (this is what makes `<Lazy*>` code-split for free);
  // everything else — composables, stores, utils, Vue/Nuxt/Nitro APIs — is imported
  // explicitly. `autoImport: false` also stops the global .d.ts declarations being
  // generated, so a missed import fails the type check instead of resolving silently.
  imports: { autoImport: false },

  nitro: { imports: { autoImport: false } },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/functions" as *; @use "~/assets/scss/mixins" as *;',
        },
      },
    },
  },

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || '',
  },

  // Run vue-tsc during `nuxt build` so a type error fails the build ('build' = build only, not dev)
  typescript: {
    typeCheck: 'build',
  },

  modules: ['@nuxt/eslint', '@nuxt/icon', '@pinia/nuxt'],
})
