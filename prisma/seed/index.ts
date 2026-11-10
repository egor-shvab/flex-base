/** Import order matters: `.env` must load before `run.ts` pulls in `server/db/prisma.ts`. */
import 'dotenv/config'
import '~~/prisma/seed/run'
