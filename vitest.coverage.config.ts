/**
 * Fragments, not a runnable config. Named `*.config.ts` so `tsconfig.tools.json`'s glob
 * type-checks it.
 */

export const COVERAGE_BASE = {
  provider: 'v8' as const,
  exclude: ['**/*.spec.ts', 'shared/types/**', 'server/generated/**', 'server/db/prisma.ts'],
}

export const SERVER_INCLUDE = [
  'shared/**/*.ts',
  'server/api/**/*.ts',
  'server/db/**/*.ts',
  'server/middleware/**/*.ts',
  'server/services/**/*.ts',
  'server/utils/**/*.ts',
]

export const APP_INCLUDE = [
  'app/api/**/*.ts',
  'app/composables/**/*.ts',
  'app/middleware/**/*.ts',
  'app/stores/**/*.ts',
  'app/utils/**/*.ts',
  'app/field-types/**/*.ts',
  'app/components/**/use*.ts',
]
