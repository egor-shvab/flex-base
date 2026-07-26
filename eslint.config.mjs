// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt(
  // Imports are always aliased — `../../../../utils/auth` says nothing about which layer it
  // reaches into and silently rots when a file moves. Scoped to the source directories so the
  // root config files (this one included) can keep their own relative paths.
  {
    files: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Both forms are needed: minimatch's `*` does not cross `/`, so `../*`
              // alone would miss `../utils/prisma`.
              group: ['./*', './**', '../*', '../**'],
              message: 'Use an alias (~/…, #shared/…, #server/…) instead of a relative import.',
            },
          ],
        },
      ],
    },
  },
).append(eslintConfigPrettier)
