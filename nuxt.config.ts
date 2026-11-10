export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
    },
  },

  css: [
    '@fontsource/archivo/400.css',
    '@fontsource/archivo/500.css',
    '@fontsource/archivo/600.css',
    '@fontsource/archivo/700.css',
    '@fontsource/ibm-plex-mono/400.css',
    '@fontsource/ibm-plex-mono/500.css',
    '~/assets/scss/main.scss',
  ],

  // Otherwise a `.ts` beside a component (a private composable, a spec rig) registers as a
  // component
  components: [{ path: '~/components', pathPrefix: false, extensions: ['.vue'] }],

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

  typescript: {
    typeCheck: 'build',
  },

  modules: ['@nuxt/eslint', '@nuxt/icon', '@pinia/nuxt'],
})
