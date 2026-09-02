import { existsSync } from 'node:fs'
import process from 'node:process'

/**
 * Starts the built server, working around a Windows-only crash in the output bundle.
 *
 * `.output/server/index.mjs` sets `globalThis._importMeta_` in its module **body**, but ESM
 * hoists imports — so the chunk holding the bundled Prisma client evaluates first, finds
 * `_importMeta_` unset, and falls back to the placeholder `file:///_entry.js`. Prisma then
 * shims `__dirname` with `fileURLToPath()` on it: harmless on POSIX (`/_entry.js`), fatal on
 * Windows, where a relative file URL throws `ERR_INVALID_FILE_URL_PATH`.
 *
 * A dynamic import is not hoisted, so assigning first is enough — the bundle's own `||`
 * fallback then keeps the real URL. Recorded in `docs/decisions.md`. **Replacing the import
 * below with a static one reintroduces the bug**, silently on POSIX and loudly on Windows.
 *
 * Both callers come through here, and the only thing they disagree about is the environment:
 * `scripts/preview.mjs` loads the root `.env` first, the end-to-end suite passes its own
 * variables through Playwright's `webServer.env` and must never see that file.
 */
const entry = new URL('../.output/server/index.mjs', import.meta.url)

// Named plainly, because the alternative is a bare `ERR_MODULE_NOT_FOUND` on a path most of
// which is this file's own arithmetic
if (!existsSync(entry)) {
  throw new Error('No build found at `.output/server`. Run `npm run build` first.')
}

globalThis._importMeta_ = { url: entry.href, env: process.env }

await import(entry.href)
