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

  // Framing is limited to our own origin, not refused: DevTools frames the app in development.
  // HSTS belongs to whatever terminates TLS. A script policy would need nonces for Nuxt's inline
  // payload, so the CSP carries only directives that cannot break a page
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      },
    },
  },

  // Filled at start-up from `NUXT_JWT_SECRET`. A default read from `process.env` here would be
  // frozen into the build and keep signing with it whatever the deployment sets
  runtimeConfig: {
    jwtSecret: '',
  },

  typescript: {
    typeCheck: 'build',
  },

  modules: ['@nuxt/eslint', '@nuxt/icon', '@pinia/nuxt'],
})
