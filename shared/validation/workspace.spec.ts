import { describe, expect, it } from 'vitest'
import {
  invitationInputSchema,
  memberRoleInputSchema,
  roleInputSchema,
  transferOwnershipSchema,
  workspaceInputSchema,
} from '#shared/validation/workspace'

describe('workspaceInputSchema', () => {
  it('accepts a trimmed name and drops anything else', () => {
    expect(workspaceInputSchema.parse({ name: '  Acme  ', ownerId: 'crafted' })).toEqual({
      name: 'Acme',
    })
  })

  it('inherits the shared name rule', () => {
    expect(workspaceInputSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(workspaceInputSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('roleInputSchema', () => {
  it('accepts a name and a set of known permissions', () => {
    expect(
      roleInputSchema.parse({
        name: ' Editor ',
        permissions: ['RECORDS_CREATE', 'RECORDS_UPDATE'],
      }),
    ).toEqual({ name: 'Editor', permissions: ['RECORDS_CREATE', 'RECORDS_UPDATE'] })
  })

  it('accepts a role with no permissions at all', () => {
    expect(roleInputSchema.safeParse({ name: 'Viewer', permissions: [] }).success).toBe(true)
  })

  it('rejects a permission outside the closed list', () => {
    expect(
      roleInputSchema.safeParse({ name: 'Root', permissions: ['WORKSPACE_DELETE'] }).success,
    ).toBe(false)
  })

  it('rejects a permission listed twice', () => {
    const result = roleInputSchema.safeParse({
      name: 'Editor',
      permissions: ['RECORDS_CREATE', 'RECORDS_CREATE'],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['permissions'])
  })

  it.each(['Owner', 'owner', '  OWNER  '])('reserves %j for the workspace owner', (name) => {
    const result = roleInputSchema.safeParse({ name, permissions: [] })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('allows a name that only contains the reserved one', () => {
    expect(roleInputSchema.safeParse({ name: 'Owners’ assistant', permissions: [] }).success).toBe(
      true,
    )
  })

  it('requires the permissions, rather than reading their absence as none', () => {
    expect(roleInputSchema.safeParse({ name: 'Viewer' }).success).toBe(false)
  })
})

describe('invitationInputSchema', () => {
  it('stores the email trimmed and lower-cased, so one address is one invitation', () => {
    expect(invitationInputSchema.parse({ email: '  Ada@Example.COM ', roleId: 'rol_1' })).toEqual({
      email: 'ada@example.com',
      roleId: 'rol_1',
    })
  })

  it('rejects an address that is not one', () => {
    expect(invitationInputSchema.safeParse({ email: 'ada', roleId: 'rol_1' }).success).toBe(false)
  })

  it('requires a role', () => {
    expect(invitationInputSchema.safeParse({ email: 'ada@example.com', roleId: ' ' }).success).toBe(
      false,
    )
  })
})

describe('the id-only inputs', () => {
  it('take a role for a member and a member for a transfer', () => {
    expect(memberRoleInputSchema.parse({ roleId: 'rol_1' })).toEqual({ roleId: 'rol_1' })
    expect(transferOwnershipSchema.parse({ memberId: 'mem_1' })).toEqual({ memberId: 'mem_1' })
  })

  it('refuse a blank id', () => {
    expect(memberRoleInputSchema.safeParse({ roleId: '' }).success).toBe(false)
    expect(transferOwnershipSchema.safeParse({}).success).toBe(false)
  })
})
