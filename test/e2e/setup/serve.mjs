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
 * fallback then keeps the real URL. Recorded in `docs/decisions.md`; `npm run preview` is
 * still broken on Windows for the same reason.
 */
const entry = new URL('../../../.output/server/index.mjs', import.meta.url)

globalThis._importMeta_ = { url: entry.href, env: process.env }

await import(entry.href)
