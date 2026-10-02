// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

const NO_RELATIVE_IMPORTS = {
  group: ['./*', './**', '../*', '../**'],
  message: 'Use an alias (~/…, #shared/…, #server/…) instead of a relative import.',
}

/**
 * `regex`, not `group`: group patterns use gitignore syntax, where a leading `#` starts a comment,
 * so `#server/...` would match nothing and pass silently.
 */
const NO_UPWARD_SERVER_IMPORTS = {
  regex: '^#server/(services|api)/',
  message: 'Dependencies point downward: db/ and utils/ may not import services/ or api/.',
}

export default withNuxt(
  // A Claude Code worktree under `.claude/` carries this config too, and ESLint resolves a config
  // per linted file, so `eslint .` would load that copy and fail on its absent `.nuxt/`.
  { ignores: ['.claude/**', 'docs/design/**'] },

  {
    files: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', './**', '../*', '../**'],
              message: 'Use an alias (~/…, #shared/…, #server/…) instead of a relative import.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['shared/field-types/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_RELATIVE_IMPORTS,
            {
              regex: '^#shared/(utils|validation)/',
              message:
                'A field type is read by utils/ and validation/, never the reverse — that direction is what keeps the shared layer acyclic.',
            },
          ],
        },
      ],
    },
  },

  // `tables/*/**`, not `tables/[tableAddress]/**`: minimatch reads the brackets as a character
  // class. The patch and delete routes sit one level up, outside this glob by construction.
  {
    files: ['server/api/tables/*/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^#server/utils/auth$',
              message:
                'Table-scoped routes take their user from a handler factory (#server/utils/handler), which proves ownership first.',
            },
          ],
        },
      ],
    },
  },

  // Two blocks, not one with an extra pattern: flat config replaces a rule's options rather than
  // merging them, so a second matching block would silently drop the shared patterns.
  {
    files: ['server/utils/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_RELATIVE_IMPORTS, NO_UPWARD_SERVER_IMPORTS] },
      ],
    },
  },

  // A package import is invisible to the alias patterns, so `h3` needs `paths`.
  {
    files: ['server/db/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [NO_RELATIVE_IMPORTS, NO_UPWARD_SERVER_IMPORTS],
          paths: [
            {
              name: 'h3',
              message:
                'The persistence layer does not speak HTTP. Classify the fault here and map it in #server/utils/http-errors.',
            },
          ],
        },
      ],
    },
  },
).append(eslintConfigPrettier)
