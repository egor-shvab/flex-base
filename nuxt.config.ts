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

  // Not cosmetic: the scanner defaults to every builder extension, so a `.ts` file beside its
  // component — a private composable, a spec's rig — is registered as a global component of its
  // own. Every component here is a `.vue` file, so say that.
  components: [{ path: '~/components', pathPrefix: false, extensions: ['.vue'] }],

  // Components stay auto-imported (what makes `<Lazy*>` code-split for free); everything else is
  // imported explicitly. `autoImport: false` also stops the global .d.ts declarations being
  // generated, so a missed import fails the type check rather than resolving silently.
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
