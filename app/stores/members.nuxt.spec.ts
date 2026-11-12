import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IWorkspaceMember } from '#shared/types/workspace'
import { useMembersStore } from '~/stores/members'

const WS = 'k3f9x2m8qa'

const buildMember = (id: string, name: string, roleName = 'Editor'): IWorkspaceMember => ({
  id,
  isOwner: false,
  user: { id: `usr_${id}`, name },
  email: `${name.toLowerCase()}@example.com`,
  role: { id: `rol_${roleName.toLowerCase()}`, name: roleName, permissions: [] },
  joinedAt: '2026-02-01T10:00:00.000Z',
})

let roleChange: unknown = null

registerEndpoint(`/api/workspaces/${WS}/members`, {
  method: 'GET',
  handler: () => ({ members: [buildMember('mem_a', 'Ada'), buildMember('mem_g', 'Grace')] }),
})

registerEndpoint(`/api/workspaces/${WS}/members/mem_g`, {
  method: 'PATCH',
  handler: async (event) => {
    roleChange = await readBody(event)
    return { member: buildMember('mem_g', 'Grace', 'Viewer') }
  },
})

registerEndpoint(`/api/workspaces/${WS}/members/mem_g`, {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

describe('useMembersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    roleChange = null
  })

  it('keeps a member’s new role in place in the list', async () => {
    const store = useMembersStore()
    await store.fetchMembers(WS)

    await store.changeMemberRole(WS, 'mem_g', 'rol_viewer')

    expect(roleChange).toEqual({ roleId: 'rol_viewer' })
    expect(store.members.map((member) => [member.user.name, member.role.name])).toEqual([
      ['Ada', 'Editor'],
      ['Grace', 'Viewer'],
    ])
  })

  it('drops a removed member', async () => {
    const store = useMembersStore()
    await store.fetchMembers(WS)

    await store.removeMember(WS, 'mem_g')

    expect(store.members.map((member) => member.id)).toEqual(['mem_a'])
  })
})
