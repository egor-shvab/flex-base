/**
 * `npm run db:seed` — the demo workspace for `test@test.com`.
 *
 * The two imports below are ordered, and the order is the whole file: ESM evaluates static
 * imports in declaration order, so `.env` is in `process.env` before `run.ts` pulls in
 * `server/db/prisma.ts`, which reads `DATABASE_URL` at module load and would otherwise construct
 * its client against nothing. The same shape as `scripts/preview.mjs`, for the same reason.
 */
import 'dotenv/config'
import '~~/prisma/seed/run'
