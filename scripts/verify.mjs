// The definition of done's fast steps in one run, printing a line per step and, for the first that
// fails, only the tail of its output. `--check` checks formatting instead of writing it; `--build`
// and `--integration` add those steps; `--e2e` the browser suite, which needs a fresh build first.
import { spawnSync } from 'node:child_process'

const TAIL_LINES = 80

const flags = new Set(process.argv.slice(2))

const steps = [
  flags.has('--check')
    ? ['format', 'npx prettier --check . --log-level warn']
    : ['format', 'npx prettier --write . --log-level warn'],
  ['lint', 'npx eslint .'],
  ['typecheck', 'npm run typecheck --silent'],
  ['unit + nuxt', 'npx vitest run'],
  ...(flags.has('--build') || flags.has('--e2e') ? [['build', 'npm run build --silent']] : []),
  ...(flags.has('--integration') || flags.has('--e2e')
    ? [['database', 'docker compose up -d --wait']]
    : []),
  ...(flags.has('--integration')
    ? [['integration', 'npx vitest run --config vitest.integration.config.ts']]
    : []),
  ...(flags.has('--e2e') ? [['e2e', 'npx playwright test --reporter=line']] : []),
]

for (const [name, command] of steps) {
  const startedAt = Date.now()
  const result = spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)

  if (result.status === 0) {
    console.log(`✓ ${name} (${seconds}s)`)
    continue
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd().split('\n')
  console.log(`✗ ${name} (${seconds}s) — last ${Math.min(TAIL_LINES, output.length)} lines:\n`)
  console.log(output.slice(-TAIL_LINES).join('\n'))
  process.exit(1)
}

console.log('\nAll green.')
