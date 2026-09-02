/**
 * `npm run preview` — the built server, run against the development environment.
 *
 * The two imports below are ordered, and the order is the whole file: ESM evaluates static
 * imports in declaration order, so `.env` is in `process.env` before the launcher hands it to
 * the bundle. Loading it here rather than inside the launcher is deliberate — the end-to-end
 * suite starts the same output through `scripts/serve-output.mjs` and must **not** see this
 * file, which points at the development database it would otherwise truncate.
 *
 * This replaces `nuxt preview`, which cannot start the output bundle on Windows at all; the
 * launcher's own comment has the diagnosis.
 */
import 'dotenv/config'
import './serve-output.mjs'
