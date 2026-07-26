import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#server/generated/prisma/client'

// Cached on globalThis so dev HMR does not open a new connection pool per reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

if (import.meta.dev) {
  globalForPrisma.prisma = prisma
}
