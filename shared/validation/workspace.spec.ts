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
  const readOnly = { readScope: 'ALL', canCreate: false, updateScope: 'NONE', deleteScope: 'NONE' }
  const role = (overrides: Record<string, unknown>) => ({
    name: 'Editor',
    permissions: [],
    recordDefaults: readOnly,
    ...overrides,
  })

  it('accepts a name, a set of known permissions and record defaults', () => {
    const recordDefaults = { ...readOnly, canCreate: true, updateScope: 'ALL' }

    expect(
      roleInputSchema.parse(
        role({ name: ' Editor ', permissions: ['TABLES_MANAGE'], recordDefaults }),
      ),
    ).toEqual({ name: 'Editor', permissions: ['TABLES_MANAGE'], recordDefaults })
  })

  it('accepts a role with no permissions at all', () => {
    expect(roleInputSchema.safeParse(role({ name: 'Viewer' })).success).toBe(true)
  })

  it('rejects a permission outside the closed list', () => {
    expect(roleInputSchema.safeParse(role({ permissions: ['RECORDS_CREATE'] })).success).toBe(false)
  })

  it('rejects a permission listed twice', () => {
    const result = roleInputSchema.safeParse(
      role({ permissions: ['TABLES_MANAGE', 'TABLES_MANAGE'] }),
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['permissions'])
  })

  it.each([
    ['their own records to edit', { updateScope: 'OWN' }],
    ['their own records to delete', { deleteScope: 'OWN' }],
    ['a narrower read', { readScope: 'NONE' }],
  ])('rejects %s until the server enforces it', (_, overrides) => {
    const result = roleInputSchema.safeParse(
      role({ recordDefaults: { ...readOnly, ...overrides } }),
    )

    expect(result.success).toBe(false)
  })

  it('requires the record defaults, rather than reading their absence as none', () => {
    expect(roleInputSchema.safeParse(role({ recordDefaults: undefined })).success).toBe(false)
  })

  it.each(['Owner', 'owner', '  OWNER  '])('reserves %j for the workspace owner', (name) => {
    const result = roleInputSchema.safeParse(role({ name }))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('allows a name that only contains the reserved one', () => {
    expect(roleInputSchema.safeParse(role({ name: 'Owners’ assistant' })).success).toBe(true)
  })

  it('requires the permissions, rather than reading their absence as none', () => {
    expect(roleInputSchema.safeParse(role({ permissions: undefined })).success).toBe(false)
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
