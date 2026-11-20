import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { FieldService } from '#server/services/fields'
import { TableService } from '#server/services/tables'
import { requireMembership } from '#server/utils/workspace-access'
import type {
  ITableAccess,
  TFieldAccessOverride,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { toRoleHolder } from '#shared/utils/role-access'
import { canReadRecords, resolveFieldAccess, resolveTableAccess } from '#shared/utils/table-access'
import { fieldInputSchema } from '#shared/validation/field'
import {
  addMember,
  createField,
  createTable,
  createUser,
  setTableAccess,
  type TSeededUser,
} from '~~/test/integration/seed'
import { buildTableAccess } from '~~/test/membership'

/**
 * Two rules are written twice — once in TypeScript, once as a Prisma `where` — and nothing but this
 * spec holds the two together: which tables a member is listed (`buildReadableTablesWhere` against
 * `resolveTableAccess`), and which role blocks a field from turning required
 * (`FieldService.assertRequiredFillable` against `resolveFieldAccess`). Each case asks the database
 * and the shared rule the same question.
 */

let ada: TSeededUser

beforeEach(async () => {
  ada = await createUser('ada@example.com')
})

const PERMISSION_SETS: [string, TWorkspacePermission[]][] = [
  ['no permission', []],
  ['manages tables', ['TABLES_MANAGE']],
]

const READ_ROWS: [string, ITableAccess | null][] = [
  ['no row', null],
  ['a row reading its own', buildTableAccess({ readScope: 'OWN' })],
  ['a row reading all', buildTableAccess()],
]

async function createRole(name: string, permissions: TWorkspacePermission[]) {
  return prisma.workspaceRole.create({
    data: { workspaceId: ada.workspace.id, name, permissions },
    select: { id: true },
  })
}

describe('the tables a member is listed match the tables the shared rule lets them read', () => {
  it.each(
    PERMISSION_SETS.flatMap(([permissionLabel, permissions]) =>
      READ_ROWS.map(([rowLabel, row]) => [`${permissionLabel}, ${rowLabel}`, permissions, row]),
    ) as [string, TWorkspacePermission[], ITableAccess | null][],
  )('%s', async (_, permissions, row) => {
    const table = await createTable(ada.workspace.id, 'Deals')
    await createRole('Subject', permissions)
    if (row) await setTableAccess(ada.workspace.id, 'Subject', table.id, row)
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Subject')
    const member = await requireMembership(bob.id, ada.workspace.publicId)

    const listed = (await TableService.listTables(member)).some(({ id }) => id === table.id)

    expect(listed).toBe(canReadRecords(resolveTableAccess(member, row)))
  })

  it('the owner, with no row for their role', async () => {
    const table = await createTable(ada.workspace.id, 'Deals')
    await prisma.roleTableAccess.deleteMany({ where: { tableId: table.id } })
    const owner = await requireMembership(ada.id, ada.workspace.publicId)

    const listed = (await TableService.listTables(owner)).some(({ id }) => id === table.id)

    expect(listed).toBe(canReadRecords(resolveTableAccess(owner, null)))
  })
})

describe('a field may turn required exactly when the shared rule lets every adding role fill it', () => {
  const FIELD_ROWS: [string, TFieldAccessOverride | null][] = [
    ['no field row', null],
    ['the field hidden', 'HIDDEN'],
    ['the field read only', 'READ'],
  ]

  it.each(
    PERMISSION_SETS.flatMap(([permissionLabel, permissions]) =>
      [true, false].flatMap((canCreate) =>
        FIELD_ROWS.map(([fieldLabel, fieldRow]) => [
          `${permissionLabel}, ${canCreate ? 'adding' : 'not adding'}, ${fieldLabel}`,
          permissions,
          canCreate,
          fieldRow,
        ]),
      ),
    ) as [string, TWorkspacePermission[], boolean, TFieldAccessOverride | null][],
  )('%s', async (_, permissions, canCreate, fieldRow) => {
    const table = await createTable(ada.workspace.id, 'Deals')
    const field = await createField(table.id, { key: 'stage', type: 'TEXT', name: 'Stage' })
    const role = await createRole('Subject', permissions)
    const tableAccess = buildTableAccess({ canCreate })
    await setTableAccess(ada.workspace.id, 'Subject', table.id, tableAccess)
    if (fieldRow) {
      await prisma.roleFieldAccess.create({
        data: {
          workspaceId: ada.workspace.id,
          roleId: role.id,
          fieldId: field.id,
          access: fieldRow,
        },
      })
    }

    const holder = toRoleHolder({ permissions })
    const access = resolveTableAccess(holder, tableAccess)
    const isBlocked = access.canCreate && resolveFieldAccess(holder, access, fieldRow) !== 'EDIT'

    const update = FieldService.updateField(
      table.id,
      field.id,
      fieldInputSchema.parse({ name: 'Stage', type: 'TEXT', required: true }),
    )

    if (isBlocked) await expect(update).rejects.toMatchObject({ statusCode: 409 })
    else await expect(update).resolves.toMatchObject({ required: true })
  })
})
