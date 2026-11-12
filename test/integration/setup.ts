import { afterAll, beforeEach } from 'vitest'
import { prisma } from '#server/db/prisma'

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User", "Workspace", "WorkspaceRole", "WorkspaceMember", "WorkspaceInvitation", "Table", "Field", "Record" CASCADE',
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})
