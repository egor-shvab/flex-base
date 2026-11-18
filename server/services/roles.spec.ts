import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { FULL_TABLE_ACCESS, NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type {
  IFieldAccessOverride,
  ITableAccess,
  ITableAccessOverride,
  TWorkspacePermission,
} from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'
import {
  buildMembership,
  buildPermissionSetRow as setRow,
  buildTableAccess,
  buildRoleInput,
  MEMBERSHIP_WORKSPACE_ID as WORKSPACE_ID,
} from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const ROLE_ID = 'rol_1'
const ACTOR_ROLE_ID = 'rol_actor'

const managerDeals = { canCreate: true, updateScope: 'ALL' } as const
const manager = buildMembership(['ROLES_MANAGE'])
const reader = buildMembership([])
const owner = buildMembership([], { isOwner: true })

const READ_AT = new Date('2026-02-11T16:30:00.000Z')

const DEALS = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [
    { id: 'fld_company', name: 'Company', type: 'TEXT', required: true },
    { id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false },
  ],
}

/** A role's row for Deals: reading every record unless `records` says more. */
const dealsRow = (records: Partial<ITableAccess> = {}): ITableAccessOverride[] => [
  { tableId: DEALS.id, ...buildTableAccess(records) },
]

/** A role form as submitted, reaching Deals as `records` says. */
const input = (
  name: string,
  permissions: TWorkspacePermission[] = [],
  records: Partial<ITableAccess> = {},
): TRoleInput => buildRoleInput(name, permissions, dealsRow(records))

interface IGrantsRowOptions {
  id?: string
  name?: string
  tables?: ITableAccessOverride[]
  fields?: IFieldAccessOverride[]
}

/** A role as `roleGrantsSelect` reads it. */
const grantsRow = (
  permissions: TWorkspacePermission[],
  records: Partial<ITableAccess> = {},
  { id = ROLE_ID, name = 'Clerk', tables = dealsRow(records), fields = [] }: IGrantsRowOptions = {},
) => ({
  id,
  name,
  updatedAt: READ_AT,
  ...setRow(permissions),
  tableAccess: tables,
  fieldAccess: fields,
})

/** A role as `roleSelect` reads it. */
const roleRow = (permissions: TWorkspacePermission[], memberCount = 0) => ({
  id: ROLE_ID,
  name: 'Clerk',
  ...setRow(permissions),
  updatedAt: READ_AT,
  _count: { members: memberCount, tableAccess: 1 },
})

const actorRow = (
  tables: ITableAccessOverride[] = dealsRow(managerDeals),
  fields: IFieldAccessOverride[] = [],
) =>
  grantsRow(['ROLES_MANAGE'], managerDeals, {
    id: ACTOR_ROLE_ID,
    name: 'Manager',
    tables,
    fields,
  })

/**
 * The ground every decision reads: the tables, and the roles asked for. `roleSelect` reads (the
 * list, a write's answer) share `findMany`, told apart by whether they select the role's rows.
 */
function stubGround(roles: ReturnType<typeof grantsRow>[], listed = [roleRow([])]) {
  prismaMock.table.findMany.mockResolvedValue([DEALS])
  prismaMock.workspaceRole.findMany.mockImplementation(
    async (args: { select: { tableAccess?: unknown } }) =>
      args.select.tableAccess === undefined ? listed : roles,
  )
}

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0' })

const roleWhere = { workspaceId_id: { workspaceId: WORKSPACE_ID, id: ROLE_ID } }

beforeEach(() => {
  resetPrismaMock()
})

describe('RoleService.listRoles', () => {
  it('reads this workspace’s roles in a stable order, with how many members hold each', async () => {
    prismaMock.workspaceRole.findMany.mockResolvedValue([roleRow([], 3)])

    await expect(RoleService.listRoles(reader)).resolves.toEqual([
      expect.objectContaining({
        id: ROLE_ID,
        name: 'Clerk',
        memberCount: 3,
        readableTableCount: 1,
      }),
    ])
    expect(prismaMock.workspaceRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
        select: expect.objectContaining({
          _count: {
            select: { members: true, tableAccess: true },
          },
        }),
      }),
    )
  })

  it('compares nothing for a caller who cannot act on roles, and calls none within them', async () => {
    prismaMock.workspaceRole.findMany.mockResolvedValue([roleRow([])])

    const [role] = await RoleService.listRoles(reader)

    expect(role?.isWithinCaller).toBe(false)
    expect(prismaMock.table.findMany).not.toHaveBeenCalled()
  })

  it('tells a manager which roles are within them, table and field included', async () => {
    const within = { ...roleRow([]), id: 'rol_within' }
    const beyond = { ...roleRow([]), id: 'rol_beyond' }
    stubGround(
      [
        actorRow(undefined, [{ fieldId: 'fld_salary', access: 'HIDDEN' }]),
        grantsRow(
          [],
          {},
          { id: 'rol_within', fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
        ),
        grantsRow([], {}, { id: 'rol_beyond' }),
      ],
      [within, beyond],
    )

    const roles = await RoleService.listRoles(manager)

    expect(roles.map((role) => [role.id, role.isWithinCaller])).toEqual([
      ['rol_within', true],
      ['rol_beyond', false],
    ])
  })
})

describe('RoleService.createRole', () => {
  it('creates a role within the actor’s own reach, in the proved workspace', async () => {
    stubGround([actorRow()])
    prismaMock.workspaceRole.count.mockResolvedValue(3)
    prismaMock.workspaceRole.create.mockResolvedValue(roleRow([]))

    const { role } = await RoleService.createRole(manager, input('Clerk', [], { canCreate: true }))

    expect(prismaMock.workspaceRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { workspaceId: WORKSPACE_ID, name: 'Clerk', permissions: [] },
      }),
    )
    expect(prismaMock.roleTableAccess.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WORKSPACE_ID, roleId: ROLE_ID, ...dealsRow({ canCreate: true })[0] }],
    })
    expect(role.isWithinCaller).toBe(true)
  })

  it.each([
    ['a permission the actor lacks', input('Clerk', ['TABLES_MANAGE'])],
    ['a record action the actor lacks', input('Clerk', [], { deleteScope: 'ALL' })],
  ])('refuses %s with a 403, writing nothing', async (_, roleInput) => {
    stubGround([actorRow()])

    await expect(RoleService.createRole(manager, roleInput)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('refuses a role reading all of a table the actor reads only in part', async () => {
    stubGround([actorRow([{ tableId: DEALS.id, ...buildTableAccess({ readScope: 'OWN' }) }])])

    await expect(RoleService.createRole(manager, input('Clerk'))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('lets the owner grant everything', async () => {
    stubGround([])
    prismaMock.workspaceRole.count.mockResolvedValue(0)
    prismaMock.workspaceRole.create.mockResolvedValue(roleRow([]))

    await expect(
      RoleService.createRole(owner, input('Admin', ['TABLES_MANAGE'], FULL_TABLE_ACCESS)),
    ).resolves.toBeDefined()
  })

  it('refuses a role over the cap with a 409, writing nothing', async () => {
    stubGround([actorRow()])
    prismaMock.workspaceRole.count.mockResolvedValue(MAX_WORKSPACE_ROLES)

    await expect(RoleService.createRole(manager, input('Clerk'))).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('writes the rows it sets apart in the same transaction as the role', async () => {
    stubGround([actorRow()])
    prismaMock.workspaceRole.count.mockResolvedValue(0)
    prismaMock.workspaceRole.create.mockResolvedValue(roleRow([]))
    const tables = [{ tableId: DEALS.id, ...buildTableAccess({ readScope: 'OWN' }) }]
    const fields = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]

    const created = await RoleService.createRole(manager, { ...input('Clerk'), tables, fields })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.roleTableAccess.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WORKSPACE_ID, roleId: ROLE_ID, ...tables[0] }],
    })
    expect(prismaMock.roleFieldAccess.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WORKSPACE_ID, roleId: ROLE_ID, ...fields[0] }],
    })
    expect(created.overrides).toEqual({ tables, fields })
  })

  it('refuses a new role that adds records but cannot fill a required field', async () => {
    stubGround([actorRow()])
    const roleInput: TRoleInput = {
      ...input('Clerk', [], { canCreate: true }),
      fields: [{ fieldId: 'fld_company', access: 'READ' }],
    }

    await expect(RoleService.createRole(manager, roleInput)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('reports a taken name as a 409', async () => {
    stubGround([actorRow()])
    prismaMock.workspaceRole.count.mockResolvedValue(0)
    prismaMock.workspaceRole.create.mockRejectedValue(knownError('P2002'))

    await expect(RoleService.createRole(manager, input('Clerk'))).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A role with this name already exists',
    })
  })
})

describe('RoleService.updateRole', () => {
  it('writes the role only at the version the decision read', async () => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.update.mockResolvedValue(roleRow([]))

    await RoleService.updateRole(manager, ROLE_ID, input('Clerk'))

    expect(prismaMock.workspaceRole.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...roleWhere, updatedAt: READ_AT } }),
    )
  })

  it('is a 404 for a role outside the workspace', async () => {
    stubGround([actorRow()])

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuses to change a role that already grants more than the actor holds', async () => {
    stubGround([actorRow(), grantsRow([], { deleteScope: 'ALL' })])

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('answers 412 at once for a version that is not the one read', async () => {
    stubGround([actorRow(), grantsRow([])])

    await expect(
      RoleService.updateRole(manager, ROLE_ID, input('Clerk'), new Date('2026-01-01')),
    ).rejects.toMatchObject({ statusCode: 412 })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('refuses with a 409 when the role changed under the check', async () => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.update.mockRejectedValue(knownError('P2025'))
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ id: ROLE_ID })

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuses a table row that would add records without filling a required field', async () => {
    stubGround([actorRow(), grantsRow([])])
    const roleInput: TRoleInput = {
      ...input('Clerk', [], { canCreate: true }),
      fields: [{ fieldId: 'fld_company', access: 'READ' }],
    }

    await expect(RoleService.updateRole(manager, ROLE_ID, roleInput)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Role "Clerk" can add records to "Deals" but cannot fill "Company"',
    })
  })
})

describe('RoleService.deleteRole', () => {
  it('deletes by the compound key at the version read', async () => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.delete.mockResolvedValue({ id: ROLE_ID })

    await RoleService.deleteRole(manager, ROLE_ID)

    expect(prismaMock.workspaceRole.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...roleWhere, updatedAt: READ_AT } }),
    )
  })

  it('refuses a role above the actor before deleting', async () => {
    stubGround([actorRow(), grantsRow(['TABLES_MANAGE'])])

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.delete).not.toHaveBeenCalled()
  })

  it('turns a role still held by a member into a 409, without counting first', async () => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.delete.mockRejectedValue(knownError('P2003'))

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.workspaceMember.count).not.toHaveBeenCalled()
  })
})

describe('RoleService.requireAssignableRole', () => {
  it('passes a role within the actor’s reach', async () => {
    stubGround([actorRow(), grantsRow([], { canCreate: true })])

    await expect(RoleService.requireAssignableRole(manager, ROLE_ID)).resolves.toBeUndefined()
    expect(prismaMock.workspaceRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID, id: { in: [ACTOR_ROLE_ID, ROLE_ID] } },
      }),
    )
  })

  it('refuses one that sees a field hidden from the actor', async () => {
    stubGround([actorRow(undefined, [{ fieldId: 'fld_salary', access: 'HIDDEN' }]), grantsRow([])])

    await expect(RoleService.requireAssignableRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('answers a role of another workspace as missing', async () => {
    stubGround([actorRow()])

    await expect(RoleService.requireAssignableRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('RoleService.updateRole — the rows a role sets apart', () => {
  const access = (overrides: Partial<TRoleInput> = {}): TRoleInput => ({
    ...input('Clerk'),
    ...overrides,
  })

  beforeEach(() => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.update.mockResolvedValue(roleRow([]))
  })

  it('replaces the role’s rows in one transaction, the guarded role write first', async () => {
    const tables = [{ tableId: DEALS.id, ...buildTableAccess({ readScope: 'OWN' }) }]
    const fields = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]

    await RoleService.updateRole(manager, ROLE_ID, access({ tables, fields }))

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspaceRole.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...roleWhere, updatedAt: READ_AT } }),
    )
    expect(prismaMock.roleTableAccess.deleteMany).toHaveBeenCalledWith({
      where: { roleId: ROLE_ID },
    })
    expect(prismaMock.roleFieldAccess.deleteMany).toHaveBeenCalledWith({
      where: { roleId: ROLE_ID },
    })
    expect(prismaMock.roleTableAccess.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WORKSPACE_ID, roleId: ROLE_ID, ...tables[0] }],
    })
    expect(prismaMock.roleFieldAccess.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: WORKSPACE_ID, roleId: ROLE_ID, ...fields[0] }],
    })
  })

  it.each([
    ['a table', access({ tables: [{ tableId: 'tbl_elsewhere', ...buildTableAccess() }] })],
    ['a field', access({ fields: [{ fieldId: 'fld_elsewhere', access: 'HIDDEN' }] })],
  ])('answers %s of another workspace with a 404, writing nothing', async (_, next) => {
    await expect(RoleService.updateRole(manager, ROLE_ID, next)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a field row on a table the role does not see', async () => {
    const next = access({
      tables: [{ tableId: DEALS.id, ...buildTableAccess({ readScope: 'NONE' }) }],
      fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }],
    })

    await expect(RoleService.updateRole(manager, ROLE_ID, next)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuses access wider than the actor’s, on one table', async () => {
    const next = access({ tables: [{ tableId: DEALS.id, ...FULL_TABLE_ACCESS }] })

    await expect(RoleService.updateRole(manager, ROLE_ID, next)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses hiding a required field from a role that adds records', async () => {
    const next = access({
      tables: dealsRow({ canCreate: true }),
      fields: [{ fieldId: 'fld_company', access: 'HIDDEN' }],
    })

    await expect(RoleService.updateRole(manager, ROLE_ID, next)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Role "Clerk" can add records to "Deals" but cannot fill "Company"',
    })
  })
})

describe('the schema a role editor is shown', () => {
  const salaryHidden = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]
  const withoutSalary = { ...DEALS, fields: DEALS.fields.filter((f) => f.id !== 'fld_salary') }

  it('reads the proved workspace’s tables with their fields', async () => {
    stubGround([actorRow()])

    await expect(RoleService.listAccessTables(manager)).resolves.toEqual([DEALS])
    expect(prismaMock.table.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WORKSPACE_ID } }),
    )
  })

  it('leaves out a table the caller does not read, and a field hidden from them', async () => {
    stubGround([actorRow(dealsRow(managerDeals), salaryHidden)])
    await expect(RoleService.listAccessTables(manager)).resolves.toEqual([withoutSalary])

    stubGround([actorRow([])])
    await expect(RoleService.listAccessTables(manager)).resolves.toEqual([])
  })

  it('shows the owner everything, whatever their role reaches', async () => {
    stubGround([grantsRow([], {}, { id: owner.role.id, tables: [] })])

    await expect(RoleService.listAccessTables(owner)).resolves.toEqual([DEALS])
  })

  it('hands a role out with only the visible schema, but with every row it holds', async () => {
    stubGround([
      actorRow(dealsRow(managerDeals), salaryHidden),
      grantsRow([], {}, { fields: salaryHidden }),
    ])
    prismaMock.workspaceRole.findUnique.mockResolvedValue(roleRow([]))

    const detail = await RoleService.getRole(manager, ROLE_ID)

    expect(detail.tables).toEqual([withoutSalary])
    expect(detail.overrides).toEqual({ tables: dealsRow(), fields: salaryHidden })
    expect(detail.role.isWithinCaller).toBe(true)
  })
})

describe('RoleService — the role the actor holds', () => {
  it.each([
    ['change', () => RoleService.updateRole(manager, ACTOR_ROLE_ID, input('Manager'))],
    ['delete', () => RoleService.deleteRole(manager, ACTOR_ROLE_ID)],
  ])('refuses a member who would %s it, before reading anything', async (_, write) => {
    await expect(write()).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Only the workspace owner can change the role you hold',
    })
    expect(prismaMock.workspaceRole.findMany).not.toHaveBeenCalled()
  })

  it('lets the owner change the role they hold, which binds them only after a transfer', async () => {
    stubGround([grantsRow([], {}, { id: ACTOR_ROLE_ID })])
    prismaMock.workspaceRole.update.mockResolvedValue(roleRow([]))

    await expect(
      RoleService.updateRole(owner, ACTOR_ROLE_ID, input('Admin')),
    ).resolves.toBeDefined()
  })
})

describe('RoleService.setTableAccess', () => {
  const change = (access: Partial<ITableAccess>, roleId = ROLE_ID) => ({
    roleId,
    updatedAt: READ_AT.toISOString(),
    ...buildTableAccess(access),
  })

  beforeEach(() => {
    stubGround([actorRow(), grantsRow([])])
    prismaMock.workspaceRole.updateMany.mockResolvedValue({ count: 1 })
  })

  it('replaces the role’s row for the table, every role guarded by its version in one write', async () => {
    const next = change({ readScope: 'OWN' })

    await RoleService.setTableAccess(manager, DEALS.id, { roles: [next] })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspaceRole.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID, OR: [{ id: ROLE_ID, updatedAt: READ_AT }] },
      }),
    )
    expect(prismaMock.roleTableAccess.deleteMany).toHaveBeenCalledWith({
      where: { tableId: DEALS.id, roleId: { in: [ROLE_ID] } },
    })
    expect(prismaMock.roleTableAccess.createMany).toHaveBeenCalledWith({
      data: [
        {
          workspaceId: WORKSPACE_ID,
          roleId: ROLE_ID,
          tableId: DEALS.id,
          ...buildTableAccess({ readScope: 'OWN' }),
        },
      ],
    })
  })

  it('closes the table with no row, dropping the role’s field rows there', async () => {
    stubGround([
      actorRow(),
      grantsRow([], {}, { fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] }),
    ])

    await RoleService.setTableAccess(manager, DEALS.id, { roles: [change(NO_TABLE_ACCESS)] })

    expect(prismaMock.roleTableAccess.createMany).toHaveBeenCalledWith({ data: [] })
    expect(prismaMock.roleFieldAccess.deleteMany).toHaveBeenCalledWith({
      where: { roleId: { in: [ROLE_ID] }, fieldId: { in: ['fld_company', 'fld_salary'] } },
    })
  })

  it('refuses the role the actor holds, reading nothing', async () => {
    await expect(
      RoleService.setTableAccess(manager, DEALS.id, { roles: [change({}, ACTOR_ROLE_ID)] }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.workspaceRole.findMany).not.toHaveBeenCalled()
  })

  it.each([
    ['a version that is not the one read', { updatedAt: '2026-01-01T00:00:00.000Z' }, 412],
    ['access wider than the actor’s', FULL_TABLE_ACCESS, 403],
  ])('refuses %s, writing nothing', async (_, overrides, statusCode) => {
    await expect(
      RoleService.setTableAccess(manager, DEALS.id, { roles: [{ ...change({}), ...overrides }] }),
    ).rejects.toMatchObject({ statusCode })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a role beyond the actor with a 403 before weighing its version', async () => {
    stubGround([actorRow(), grantsRow(['TABLES_MANAGE'])])

    await expect(
      RoleService.setTableAccess(manager, DEALS.id, {
        roles: [{ ...change({}), updatedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('refuses adding records where the role cannot fill a required field', async () => {
    stubGround([
      actorRow(),
      grantsRow([], {}, { fields: [{ fieldId: 'fld_company', access: 'READ' }] }),
    ])

    await expect(
      RoleService.setTableAccess(manager, DEALS.id, { roles: [change({ canCreate: true })] }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('is a 409 when a role changed between the check and the write', async () => {
    prismaMock.workspaceRole.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      RoleService.setTableAccess(manager, DEALS.id, { roles: [change({ readScope: 'OWN' })] }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.roleTableAccess.createMany).not.toHaveBeenCalled()
  })
})

describe('RoleService.listTableAccess', () => {
  it('gives each role its row for the table, and nothing to a role without one', async () => {
    stubGround([actorRow(), grantsRow([], {}, { tables: [] })])

    await expect(RoleService.listTableAccess(manager, DEALS.id)).resolves.toEqual([
      { role: expect.objectContaining({ id: ROLE_ID }), access: NO_TABLE_ACCESS },
    ])
  })
})
