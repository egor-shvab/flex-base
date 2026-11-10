import { defineConfig } from 'vitest/config'
import { APP_INCLUDE, COVERAGE_BASE, SERVER_INCLUDE } from './vitest.coverage.config.ts'

export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.nuxt.config.ts'],

    coverage: {
      ...COVERAGE_BASE,
      include: [...SERVER_INCLUDE, ...APP_INCLUDE],
    },
  },
})
