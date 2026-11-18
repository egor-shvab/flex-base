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
    tables: [],
    fields: [],
    ...overrides,
  })
  const dealsRow = (access: Record<string, unknown>) => ({
    tableId: 'tbl_deals',
    ...readOnly,
    ...access,
  })

  it('accepts a name, a set of known permissions and its rows, dropping anything else', () => {
    const tables = [dealsRow({ canCreate: true, updateScope: 'ALL' })]

    expect(
      roleInputSchema.parse(
        role({
          name: ' Editor ',
          permissions: ['TABLES_MANAGE'],
          tables,
          recordDefaults: readOnly,
        }),
      ),
    ).toEqual({ name: 'Editor', permissions: ['TABLES_MANAGE'], tables, fields: [] })
  })

  it('accepts a role with no permissions and no table at all', () => {
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

  it('accepts a table row scoped to its own records', () => {
    const tables = [
      dealsRow({ readScope: 'OWN', canCreate: true, updateScope: 'OWN', deleteScope: 'OWN' }),
    ]

    expect(roleInputSchema.safeParse(role({ tables })).success).toBe(true)
  })

  it('refuses adding records with a read of none', () => {
    const result = roleInputSchema.safeParse(
      role({ tables: [dealsRow({ readScope: 'NONE', canCreate: true })] }),
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['tables', 0, 'canCreate'])
  })

  it.each(['updateScope', 'deleteScope'])('rejects a %s wider than the read', (key) => {
    const result = roleInputSchema.safeParse(
      role({ tables: [dealsRow({ readScope: 'OWN', [key]: 'ALL' })] }),
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['tables', 0, key])
  })

  it.each(['Owner', 'owner', '  OWNER  '])('reserves %j for the workspace owner', (name) => {
    const result = roleInputSchema.safeParse(role({ name }))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('allows a name that only contains the reserved one', () => {
    expect(roleInputSchema.safeParse(role({ name: 'Owners’ assistant' })).success).toBe(true)
  })

  it.each(['permissions', 'tables'])(
    'requires the %s, rather than reading their absence as none',
    (key) => {
      expect(roleInputSchema.safeParse(role({ [key]: undefined })).success).toBe(false)
    },
  )

  it('accepts table and field rows', () => {
    const input = role({
      tables: [dealsRow({ readScope: 'OWN' })],
      fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }],
    })

    expect(roleInputSchema.parse(input)).toEqual(input)
  })

  it('refuses a table listed twice', () => {
    const row = dealsRow({})

    expect(roleInputSchema.safeParse(role({ tables: [row, row] })).success).toBe(false)
  })

  it('refuses a field listed twice', () => {
    const row = { fieldId: 'fld_salary', access: 'READ' }

    expect(roleInputSchema.safeParse(role({ fields: [row, row] })).success).toBe(false)
  })

  it('refuses EDIT as a field row, which is the absence of one', () => {
    const fields = [{ fieldId: 'fld_salary', access: 'EDIT' }]

    expect(roleInputSchema.safeParse(role({ fields })).success).toBe(false)
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
