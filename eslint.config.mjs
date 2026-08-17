// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

/**
 * Both forms are needed: minimatch's `*` does not cross `/`, so `../*` alone would miss
 * `../utils/prisma`.
 */
const NO_RELATIVE_IMPORTS = {
  group: ['./*', './**', '../*', '../**'],
  message: 'Use an alias (~/…, #shared/…, #server/…) instead of a relative import.',
}

/**
 * `regex`, not `group`. Group patterns are matched with gitignore syntax, where a leading `#`
 * starts a **comment** — so `#server/services/*` matches nothing at all and the rule passes
 * silently. Any alias-prefixed restriction has to be a regex; only relative patterns can be
 * expressed as a group.
 */
const NO_UPWARD_SERVER_IMPORTS = {
  regex: '^#server/(services|api)/',
  message: 'Dependencies point downward: db/ and utils/ may not import services/ or api/.',
}

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

  // A table-scoped route reaches its user through a handler factory, never by resolving one
  // itself — the factory is what makes the ownership check unskippable, and it is only
  // unskippable while nothing under here can go around it. The two sibling routes that do use
  // `requireUser` (`[tableId].patch`, `[tableId].delete`) are files one level up, not in this
  // directory, so they are outside this glob by construction rather than by exemption.
  //
  // `tables/*/**` rather than `tables/[tableId]/**`: minimatch reads `[tableId]` as a character
  // class, so the literal spelling matches a one-character directory name and nothing else.
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

  // The server's layers point one way — `api → services → db`, with `utils` cross-cutting and
  // importing none of the three. Stated here rather than trusted, because the edge that was
  // wrong before (`utils/ownership` reaching into `services/`) compiled perfectly well.
  // Specs are exempt: a spec sits beside its subject and may reach wherever it needs to.
  //
  // **Two blocks, not one with an extra pattern.** Flat config *replaces* a rule's options rather
  // than merging them, so a second block matching `server/db/**` would silently drop the shared
  // patterns instead of adding to them. Hence the hoisted constants above.
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

  // `db/` additionally may not import `h3`: persistence classifies a fault, it does not decide
  // what the response is. `prisma-errors.ts` used to build the HTTP error itself, which is the
  // edge this closes — and an import of a package is invisible to the alias rules above, so it
  // needs `paths` (an exact module name) rather than a pattern.
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
