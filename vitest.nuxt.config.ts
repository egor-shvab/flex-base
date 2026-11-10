import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    name: 'nuxt',
    environment: 'nuxt',
    globals: false,
    include: ['{app,shared}/**/*.nuxt.spec.ts'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
  },
})
