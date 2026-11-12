import { afterAll, beforeEach } from 'vitest'
import { prisma } from '#server/db/prisma'

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User", "Workspace", "WorkspaceRole", "WorkspaceMember", "Table", "Field", "Record" CASCADE',
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})
