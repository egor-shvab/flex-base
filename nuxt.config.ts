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

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/functions" as *;',
        },
      },
    },
  },

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || '',
  },

  modules: ['@nuxt/eslint', '@nuxt/fonts', '@nuxt/icon', '@nuxt/image', '@pinia/nuxt'],
})
