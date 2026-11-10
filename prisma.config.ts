import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // The seed loads `.env` itself, since Prisma runs this as a detached process
    seed: 'tsx --tsconfig tsconfig.seed.json prisma/seed/index.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
