import { existsSync } from 'node:fs'
import process from 'node:process'

/**
 * Works around a Windows-only crash: ESM hoists imports, so the bundled Prisma chunk evaluates
 * before the entry sets `globalThis._importMeta_` and resolves a relative file URL that throws.
 * A dynamic import is not hoisted. Replacing it with a static one reintroduces the bug.
 */
const entry = new URL('../.output/server/index.mjs', import.meta.url)

if (!existsSync(entry)) {
  throw new Error('No build found at `.output/server`. Run `npm run build` first.')
}

globalThis._importMeta_ = { url: entry.href, env: process.env }

await import(entry.href)
