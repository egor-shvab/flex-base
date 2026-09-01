import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // So `npx prisma db seed` and `npm run db:seed` are the same command. The seed loads `.env`
    // itself — see `prisma/seed/index.ts` — because Prisma runs this as a detached process.
    seed: 'tsx --tsconfig tsconfig.seed.json prisma/seed/index.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
