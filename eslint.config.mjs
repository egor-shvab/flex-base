// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt(
  // A Claude Code worktree is a full checkout of this repo under `.claude/worktrees/`, config
  // file and all. ESLint 10 resolves a config **per linted file**, so `eslint .` loads that
  // copy — which fails on its absent `.nuxt/`, taking the whole run down. `.gitignore` cannot
  // say this: flat config does not read it. An `ignores`-only object is a global ignore.
  { ignores: ['.claude/**'] },

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
