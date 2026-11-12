import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceService } from '#server/services/workspaces'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const USER_ID = 'usr_1'

beforeEach(() => {
  resetPrismaMock()
})

describe('WorkspaceService.setLastWorkspace', () => {
  it('writes only the caller’s own row', async () => {
    prismaMock.user.update.mockResolvedValue({ id: USER_ID })

    await WorkspaceService.setLastWorkspace(USER_ID, 'wsp_1')

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID }, data: { lastWorkspaceId: 'wsp_1' } }),
    )
  })
})
