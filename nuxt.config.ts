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

  components: [{ path: '~/components', pathPrefix: false }],

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

  modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxt/image', '@pinia/nuxt'],
})
