import { beforeEach, describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import workspacesGet from '#server/api/workspaces/index.get'
import workspacesPost from '#server/api/workspaces/index.post'
import workspaceGet from '#server/api/workspaces/[workspaceAddress]/index.get'
import workspacePatch from '#server/api/workspaces/[workspaceAddress]/index.patch'
import workspaceDelete from '#server/api/workspaces/[workspaceAddress]/index.delete'
import workspaceVisitPut from '#server/api/workspaces/[workspaceAddress]/visit.put'
import workspaceTransferPost from '#server/api/workspaces/[workspaceAddress]/transfer.post'
import workspaceLeavePost from '#server/api/workspaces/[workspaceAddress]/leave.post'
import membersGet from '#server/api/workspaces/[workspaceAddress]/members/index.get'
import memberPatch from '#server/api/workspaces/[workspaceAddress]/members/[memberId].patch'
import memberDelete from '#server/api/workspaces/[workspaceAddress]/members/[memberId].delete'
import invitationsGet from '#server/api/workspaces/[workspaceAddress]/invitations/index.get'
import invitationsPost from '#server/api/workspaces/[workspaceAddress]/invitations/index.post'
import invitationDelete from '#server/api/workspaces/[workspaceAddress]/invitations/[invitationId].delete'
import incomingInvitationsGet from '#server/api/invitations/index.get'
import incomingInvitationAccept from '#server/api/invitations/[invitationId]/accept.post'
import incomingInvitationDecline from '#server/api/invitations/[invitationId]/index.delete'
import rolesGet from '#server/api/workspaces/[workspaceAddress]/roles/index.get'
import rolesPost from '#server/api/workspaces/[workspaceAddress]/roles/index.post'
import roleTablesGet from '#server/api/workspaces/[workspaceAddress]/roles/tables.get'
import roleGet from '#server/api/workspaces/[workspaceAddress]/roles/[roleId].get'
import rolePut from '#server/api/workspaces/[workspaceAddress]/roles/[roleId].put'
import roleDelete from '#server/api/workspaces/[workspaceAddress]/roles/[roleId].delete'
import tableGet from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress].get'
import tablePatch from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress].patch'
import tableDelete from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress].delete'
import fieldsGet from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/fields/index.get'
import fieldsPost from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/fields/index.post'
import fieldPatch from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/fields/[fieldId].patch'
import fieldDelete from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/fields/[fieldId].delete'
import optionsGet from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/fields/[fieldId]/options.get'
import recordsGet from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/index.get'
import recordsPost from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/index.post'
import recordGet from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/[recordAddress].get'
import recordPatch from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/[recordAddress].patch'
import recordDelete from '#server/api/workspaces/[workspaceAddress]/tables/[tableAddress]/records/[recordAddress].delete'
import tablesGet from '#server/api/workspaces/[workspaceAddress]/tables/index.get'
import tablesPost from '#server/api/workspaces/[workspaceAddress]/tables/index.post'
import { prisma } from '#server/db/prisma'
import type { TTableRouteAccess } from '#server/utils/handler'
import type { ITableAccess } from '#shared/types/workspace'
import { testEvent } from '~~/test/integration/event'
import { buildTableAccess, buildRoleInput } from '~~/test/membership'
import {
  addMember,
  createField,
  createRecord,
  createTable,
  createUser,
  type TSeededUser,
  setTableAccess as setRoleTableAccess,
} from '~~/test/integration/seed'

type THandler = (event: H3Event) => unknown

interface IWorld {
  ada: TSeededUser
  mallory: TSeededUser
  tableId: string
  fieldId: string
  relationFieldId: string
  recordId: string
  viewerRoleId: string
  adaMemberId: string
  invitationId: string
}

interface IEndpoint {
  name: string
  handler: THandler
  access: TTableRouteAccess
  params: Record<string, string>
  body?: unknown
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}

let world: IWorld

beforeEach(async () => {
  const ada = await createUser('ada@example.com')
  const mallory = await createUser('mallory@example.com')

  const table = await createTable(ada.workspace.id, 'Deals')
  const field = await createField(table.id, { key: 'company', type: 'TEXT', name: 'Company' })

  const people = await createTable(ada.workspace.id, 'People')
  await createField(people.id, { key: 'full_name', type: 'TEXT' })
  const relation = await createField(table.id, {
    key: 'owner',
    name: 'Owner',
    type: 'RELATION',
    order: 1,
    options: { targetTableId: people.id, labelFieldKey: 'full_name' },
  })

  const record = await createRecord(table.id, { company: 'Acme' })
  const viewerRole = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId: ada.workspace.id, name: 'Viewer' } },
    select: { id: true },
  })

  const adaMember = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId: ada.workspace.id, userId: ada.id },
    select: { id: true },
  })
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: ada.workspace.id,
      email: 'invited@example.com',
      roleId: viewerRole.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
    select: { id: true },
  })

  world = {
    ada,
    mallory,
    tableId: table.id,
    fieldId: field.id,
    relationFieldId: relation.id,
    recordId: record.id,
    viewerRoleId: viewerRole.id,
    adaMemberId: adaMember.id,
    invitationId: invitation.id,
  }
})

const adaWorkspace = () => world.ada.workspace.publicId

function scopedEndpoints(workspaceAddress = adaWorkspace()): IEndpoint[] {
  const { tableId, fieldId, relationFieldId, recordId, viewerRoleId, adaMemberId, invitationId } =
    world
  const workspaceParams = { workspaceAddress }
  const roleParams = { workspaceAddress, roleId: viewerRoleId }
  const memberParams = { workspaceAddress, memberId: adaMemberId }
  const invitationParams = { workspaceAddress, invitationId }
  const tableParams = { workspaceAddress, tableAddress: tableId }
  const fieldParams = { ...tableParams, fieldId }
  const recordParams = { ...tableParams, recordAddress: recordId }
  const validField = { name: 'Renamed', type: 'TEXT' }

  return [
    { name: 'GET /workspaces/:ws', handler: workspaceGet, access: 'READ', params: workspaceParams },
    {
      name: 'PATCH /workspaces/:ws',
      handler: workspacePatch,
      access: 'WORKSPACE_UPDATE',
      params: workspaceParams,
      body: { name: 'Renamed' },
      method: 'PATCH',
    },
    {
      name: 'DELETE /workspaces/:ws',
      handler: workspaceDelete,
      access: 'OWNER',
      params: workspaceParams,
      method: 'DELETE',
    },
    {
      name: 'PUT /workspaces/:ws/visit',
      handler: workspaceVisitPut,
      access: 'READ',
      params: workspaceParams,
      method: 'PUT',
    },
    {
      name: 'POST /workspaces/:ws/transfer',
      handler: workspaceTransferPost,
      access: 'OWNER',
      params: workspaceParams,
      body: { memberId: adaMemberId },
      method: 'POST',
    },
    { name: 'GET /members', handler: membersGet, access: 'READ', params: workspaceParams },
    {
      name: 'PATCH /members/:id',
      handler: memberPatch,
      access: 'MEMBERS_MANAGE',
      params: memberParams,
      body: { roleId: viewerRoleId },
      method: 'PATCH',
    },
    {
      name: 'DELETE /members/:id',
      handler: memberDelete,
      access: 'MEMBERS_MANAGE',
      params: memberParams,
      method: 'DELETE',
    },
    {
      name: 'GET /invitations',
      handler: invitationsGet,
      access: 'MEMBERS_INVITE',
      params: workspaceParams,
    },
    {
      name: 'POST /invitations',
      handler: invitationsPost,
      access: 'MEMBERS_INVITE',
      params: workspaceParams,
      body: { email: 'new@example.com', roleId: viewerRoleId },
      method: 'POST',
    },
    {
      name: 'DELETE /invitations/:id',
      handler: invitationDelete,
      access: 'MEMBERS_INVITE',
      params: invitationParams,
      method: 'DELETE',
    },
    { name: 'GET /roles', handler: rolesGet, access: 'READ', params: workspaceParams },
    {
      name: 'POST /roles',
      handler: rolesPost,
      access: 'ROLES_MANAGE',
      params: workspaceParams,
      body: buildRoleInput('Clerk'),
      method: 'POST',
    },
    {
      name: 'GET /roles/tables',
      handler: roleTablesGet,
      access: 'ROLES_MANAGE',
      params: workspaceParams,
    },
    {
      name: 'GET /roles/:id',
      handler: roleGet,
      access: 'ROLES_MANAGE',
      params: roleParams,
    },
    {
      name: 'PUT /roles/:id',
      handler: rolePut,
      access: 'ROLES_MANAGE',
      params: roleParams,
      body: buildRoleInput('Viewer'),
      method: 'PUT',
    },
    {
      name: 'DELETE /roles/:id',
      handler: roleDelete,
      access: 'ROLES_MANAGE',
      params: roleParams,
      method: 'DELETE',
    },
    { name: 'GET /tables', handler: tablesGet, access: 'READ', params: workspaceParams },
    {
      name: 'POST /tables',
      handler: tablesPost,
      access: 'TABLES_MANAGE',
      params: workspaceParams,
      body: { name: 'New' },
      method: 'POST',
    },
    { name: 'GET /tables/:id', handler: tableGet, access: 'READ', params: tableParams },
    {
      name: 'PATCH /tables/:id',
      handler: tablePatch,
      access: 'TABLES_MANAGE',
      params: tableParams,
      body: { name: 'Renamed' },
      method: 'PATCH',
    },
    {
      name: 'DELETE /tables/:id',
      handler: tableDelete,
      access: 'TABLES_MANAGE',
      params: tableParams,
      method: 'DELETE',
    },
    { name: 'GET /fields', handler: fieldsGet, access: 'READ', params: tableParams },
    {
      name: 'POST /fields',
      handler: fieldsPost,
      access: 'TABLES_MANAGE',
      params: tableParams,
      body: validField,
      method: 'POST',
    },
    {
      name: 'PATCH /fields/:id',
      handler: fieldPatch,
      access: 'TABLES_MANAGE',
      params: fieldParams,
      body: validField,
      method: 'PATCH',
    },
    {
      name: 'DELETE /fields/:id',
      handler: fieldDelete,
      access: 'TABLES_MANAGE',
      params: fieldParams,
      method: 'DELETE',
    },
    {
      name: 'GET /fields/:id/options',
      handler: optionsGet,
      access: 'READ',
      params: { ...tableParams, fieldId: relationFieldId },
    },
    { name: 'GET /records', handler: recordsGet, access: 'READ', params: tableParams },
    {
      name: 'POST /records',
      handler: recordsPost,
      access: 'create',
      params: tableParams,
      body: { company: 'Beta' },
      method: 'POST',
    },
    { name: 'GET /records/:id', handler: recordGet, access: 'READ', params: recordParams },
    {
      name: 'PATCH /records/:id',
      handler: recordPatch,
      access: 'update',
      params: recordParams,
      body: { company: 'Beta' },
      method: 'PATCH',
    },
    {
      name: 'DELETE /records/:id',
      handler: recordDelete,
      access: 'delete',
      params: recordParams,
      method: 'DELETE',
    },
    // Last: it ends the caller's membership, so nothing after it would be reached as a member
    {
      name: 'POST /workspaces/:ws/leave',
      handler: workspaceLeavePost,
      access: 'READ',
      params: workspaceParams,
      method: 'POST',
    },
  ]
}

function call(endpoint: IEndpoint, user: TSeededUser) {
  return endpoint.handler(
    testEvent({ user, params: endpoint.params, body: endpoint.body, method: endpoint.method }),
  )
}

describe('a stranger gets 404, never 403', () => {
  it('on every endpoint inside a workspace they are not in', async () => {
    for (const endpoint of scopedEndpoints()) {
      await expect(call(endpoint, world.mallory), endpoint.name).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Workspace not found',
      })
    }
  })

  it('leaves the owner able to read the same endpoints', async () => {
    for (const endpoint of scopedEndpoints().filter((entry) => entry.method === undefined)) {
      await expect(call(endpoint, world.ada), endpoint.name).resolves.toBeDefined()
    }
  })

  it('cannot reach a table by its id through their own workspace', async () => {
    const own = world.mallory.workspace.publicId

    for (const endpoint of scopedEndpoints(own).filter((entry) => 'tableAddress' in entry.params)) {
      await expect(call(endpoint, world.mallory), endpoint.name).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Table not found',
      })
    }
  })

  it('reads the same for a workspace that does not exist', async () => {
    const outcomes = await Promise.all(
      [adaWorkspace(), 'zzzzzzzzzz', world.ada.workspace.id].map((workspaceAddress) =>
        Promise.resolve(
          workspaceGet(testEvent({ user: world.mallory, params: { workspaceAddress } })),
        ).catch((error: unknown) => error),
      ),
    )

    for (const outcome of outcomes) {
      expect(outcome).toMatchObject({ statusCode: 404, statusMessage: 'Workspace not found' })
    }
  })

  it('changes nothing when a stranger tries to write', async () => {
    const event = testEvent({
      user: world.mallory,
      params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId },
      body: { name: 'Pwned' },
      method: 'PATCH',
    })

    await expect(tablePatch(event)).rejects.toMatchObject({ statusCode: 404 })
    await expect(prisma.table.findUnique({ where: { id: world.tableId } })).resolves.toMatchObject({
      name: 'Deals',
    })
  })

  it('loses access on the next request once removed', async () => {
    const membership = await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')
    const read = () =>
      tablesGet(testEvent({ user: world.mallory, params: { workspaceAddress: adaWorkspace() } }))

    await expect(read()).resolves.toMatchObject({ tables: expect.any(Array) })

    await prisma.workspaceMember.delete({ where: { id: membership.id } })

    await expect(read()).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('a member is held to the permissions of their role', () => {
  it.each([
    ['Viewer', [] as TTableRouteAccess[]],
    ['Editor', ['create', 'update', 'delete'] as TTableRouteAccess[]],
  ])('refuses a %s every write their role does not grant, with a 403', async (role, granted) => {
    await addMember(world.ada.workspace.id, world.mallory.id, role)

    const refused = scopedEndpoints().filter(
      (endpoint) => endpoint.access !== 'READ' && !granted.includes(endpoint.access),
    )
    expect(refused.length).toBeGreaterThan(0)

    for (const endpoint of refused) {
      await expect(call(endpoint, world.mallory), endpoint.name).rejects.toMatchObject({
        statusCode: 403,
        statusMessage: expect.stringMatching(/^You don't have permission to /),
      })
    }
  })

  it('lets any member read everything', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    for (const endpoint of scopedEndpoints().filter((entry) => entry.access === 'READ')) {
      await expect(call(endpoint, world.mallory), endpoint.name).resolves.toBeDefined()
    }
  })

  it('lets an Editor write records', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Editor')

    const { record } = await recordsPost(
      testEvent({
        user: world.mallory,
        params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId },
        method: 'POST',
        body: { company: 'Gamma' },
      }),
    )

    expect(record.data).toMatchObject({ company: 'Gamma' })
  })

  it('checks the permission before the table, so a missing table is a 403 too', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    await expect(
      tableDelete(
        testEvent({
          user: world.mallory,
          params: { workspaceAddress: adaWorkspace(), tableAddress: 'tbl_nonexistent' },
          method: 'DELETE',
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('grants the owner everything, even under a role that grants nothing', async () => {
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId: world.ada.workspace.id, userId: world.ada.id },
      },
      data: {
        role: {
          connect: { workspaceId_name: { workspaceId: world.ada.workspace.id, name: 'Viewer' } },
        },
      },
    })

    await expect(
      tablesPost(
        testEvent({
          user: world.ada,
          params: { workspaceAddress: adaWorkspace() },
          method: 'POST',
          body: { name: 'Still mine' },
        }),
      ),
    ).resolves.toMatchObject({ table: { name: 'Still mine' } })
  })
})

describe('a role’s row for a table decides its access there', () => {
  const setTableAccess = (roleName: string, access: Partial<ITableAccess>) =>
    setRoleTableAccess(world.ada.workspace.id, roleName, world.tableId, buildTableAccess(access))

  const tableRoutes = () =>
    scopedEndpoints().filter(
      (endpoint) => 'tableAddress' in endpoint.params && endpoint.access !== 'TABLES_MANAGE',
    )

  it('hides the table: unlisted, and every route under it a 404 as if it did not exist', async () => {
    await setTableAccess('Viewer', { readScope: 'NONE' })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    const { tables } = await tablesGet(
      testEvent({ user: world.mallory, params: { workspaceAddress: adaWorkspace() } }),
    )
    expect(tables.map((table) => table.name)).toEqual(['People'])

    expect(tableRoutes().length).toBeGreaterThan(0)
    for (const endpoint of tableRoutes()) {
      await expect(call(endpoint, world.mallory), endpoint.name).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Table not found',
      })
    }
  })

  it('still shows the hidden table to a schema manager, without their write access widening', async () => {
    await prisma.workspaceRole.update({
      where: { workspaceId_name: { workspaceId: world.ada.workspace.id, name: 'Viewer' } },
      data: { permissions: ['TABLES_MANAGE'] },
    })
    await setTableAccess('Viewer', { readScope: 'NONE' })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    await expect(call(tableEndpoint('GET /tables/:id'), world.mallory)).resolves.toMatchObject({
      access: { readScope: 'ALL', canCreate: false },
    })
    await expect(call(tableEndpoint('POST /records'), world.mallory)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('grants a read-only role what its row for the table allows, there only', async () => {
    await setTableAccess('Viewer', { canCreate: true })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    await expect(call(tableEndpoint('POST /records'), world.mallory)).resolves.toMatchObject({
      record: { data: { company: 'Beta' } },
    })
    await expect(call(tableEndpoint('PATCH /records/:id'), world.mallory)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: "You don't have permission to edit records in this table",
    })
  })

  it('narrows an Editor on that table, and tells them through the table’s access', async () => {
    await setTableAccess('Editor', { canCreate: true, updateScope: 'ALL' })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Editor')

    await expect(call(tableEndpoint('GET /tables/:id'), world.mallory)).resolves.toMatchObject({
      access: { canCreate: true, updateScope: 'ALL', deleteScope: 'NONE' },
    })
    await expect(call(tableEndpoint('DELETE /records/:id'), world.mallory)).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})

describe('a field hidden from a role', () => {
  const editorRole = () =>
    prisma.workspaceRole.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId: world.ada.workspace.id, name: 'Editor' } },
      select: { id: true },
    })
  const peopleTable = () =>
    prisma.table.findFirstOrThrow({
      where: { workspaceId: world.ada.workspace.id, name: 'People' },
      select: { id: true, fields: { select: { id: true } } },
    })

  async function setFieldAccess(fieldId: string, access: 'HIDDEN' | 'READ') {
    await prisma.roleFieldAccess.create({
      data: {
        workspaceId: world.ada.workspace.id,
        roleId: (await editorRole()).id,
        fieldId,
        access,
      },
    })
  }

  async function setPeopleAccess(access: Partial<ITableAccess>) {
    await setRoleTableAccess(
      world.ada.workspace.id,
      'Editor',
      (await peopleTable()).id,
      buildTableAccess(access),
    )
  }

  const tableParams = () => ({ workspaceAddress: adaWorkspace(), tableAddress: world.tableId })
  const recordParams = () => ({ ...tableParams(), recordAddress: world.recordId })
  const optionsParams = (fieldId: string) => ({ ...tableParams(), fieldId })
  const asMallory = (input: Omit<NonNullable<Parameters<typeof testEvent>[0]>, 'user'> = {}) =>
    testEvent({ user: world.mallory, params: tableParams(), ...input })
  const patchRecord = (body: unknown) =>
    recordPatch(asMallory({ params: recordParams(), method: 'PATCH', body }))
  const storedData = async (id: string) =>
    (await prisma.record.findUniqueOrThrow({ where: { id }, select: { data: true } })).data

  beforeEach(async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Editor')
  })

  it('is absent from the fields, the list, the record and the record’s own fields', async () => {
    await setFieldAccess(world.fieldId, 'HIDDEN')

    const { fields } = await fieldsGet(asMallory())
    expect(fields.map((field) => field.key)).toEqual(['owner'])

    const page = await recordsGet(asMallory())
    expect(page.records[0]?.data).not.toHaveProperty('company')

    const detail = await recordGet(asMallory({ params: recordParams() }))
    expect(detail.record.data).not.toHaveProperty('company')
    expect(detail.fields.map((field) => field.key)).toEqual(['owner'])
  })

  it('keeps its value through a save by the role, and leaves it out of the answer', async () => {
    await setFieldAccess(world.fieldId, 'HIDDEN')

    const { record } = await patchRecord({ company: 'Forged', owner: null })

    expect(record.data).toEqual({ owner: null })
    await expect(storedData(world.recordId)).resolves.toEqual({ company: 'Acme', owner: null })
  })

  it('keeps a read-only value through a save too', async () => {
    await setFieldAccess(world.fieldId, 'READ')

    const { record } = await patchRecord({ company: 'Forged' })

    expect(record.data).toMatchObject({ company: 'Acme' })
  })

  it('lists a read-only field with the fields, and names it as one', async () => {
    await setFieldAccess(world.fieldId, 'READ')

    const { fields, readOnlyFieldIds } = await fieldsGet(asMallory())

    expect(fields.map((field) => field.key)).toEqual(['company', 'owner'])
    expect(readOnlyFieldIds).toEqual([world.fieldId])
  })

  describe('marking it required', () => {
    const markRequired = () =>
      fieldPatch(
        testEvent({
          user: world.ada,
          method: 'PATCH',
          params: { ...tableParams(), fieldId: world.fieldId },
          body: { name: 'Company', type: 'TEXT', required: true },
        }),
      )

    it.each(['HIDDEN', 'READ'] as const)(
      'is refused while a role that adds records has it %s',
      async (access) => {
        await setFieldAccess(world.fieldId, access)

        await expect(markRequired()).rejects.toMatchObject({
          statusCode: 409,
          statusMessage: 'Role "Editor" can add records but cannot fill "Company"',
        })
      },
    )

    it('is allowed once that role adds no records to this table', async () => {
      await setFieldAccess(world.fieldId, 'HIDDEN')
      await setRoleTableAccess(
        world.ada.workspace.id,
        'Editor',
        world.tableId,
        buildTableAccess({ updateScope: 'ALL' }),
      )

      await expect(markRequired()).resolves.toMatchObject({ field: { required: true } })
    })
  })

  it('leaves its key out of a record the role creates', async () => {
    await setFieldAccess(world.fieldId, 'HIDDEN')

    const { record } = await recordsPost(asMallory({ method: 'POST', body: { company: 'Forged' } }))

    await expect(storedData(record.id)).resolves.toEqual({ owner: null })
  })

  it('cannot be filtered, sorted or searched on, as if it did not exist', async () => {
    await setFieldAccess(world.fieldId, 'HIDDEN')

    const filtered = await recordsGet(asMallory({ query: { company: 'zzz' } }))
    expect(filtered.total).toBe(1)

    await expect(recordsGet(asMallory({ query: { sort: 'company' } }))).rejects.toMatchObject({
      statusCode: 400,
    })

    const searched = await recordsGet(asMallory({ query: { search: 'Acme' } }))
    expect(searched.total).toBe(0)
  })

  it('hides a link to a table the role may not read, with its options', async () => {
    await setPeopleAccess({ readScope: 'NONE' })

    const { fields } = await fieldsGet(asMallory())
    expect(fields.map((field) => field.key)).toEqual(['company'])
    await expect(
      optionsGet(asMallory({ params: optionsParams(world.relationFieldId) })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  describe('a link', () => {
    async function createPerson(name: string, createdById: string) {
      const people = await peopleTable()
      const person = await createRecord(people.id, { full_name: name })
      await prisma.record.update({ where: { id: person.id }, data: { createdById } })
      return person
    }

    const linkTo = (id: string) =>
      prisma.record.update({
        where: { id: world.recordId },
        data: { data: { company: 'Acme', owner: id } },
      })

    it('shows no label where the label field is hidden', async () => {
      const ada = await createPerson('Ada', world.ada.id)
      await linkTo(ada.id)
      await setFieldAccess((await peopleTable()).fields[0]!.id, 'HIDDEN')

      const page = await recordsGet(asMallory())
      const { options } = await optionsGet(
        asMallory({ params: optionsParams(world.relationFieldId) }),
      )

      expect(page.linkedRecords[world.relationFieldId]?.[ada.id]?.label).not.toBe('Ada')
      expect(options.map((option) => option.label)).not.toContain('Ada')
    })

    it('offers and accepts only the role’s own records of a table it reads partly', async () => {
      const theirs = await createPerson('Ada', world.ada.id)
      const mine = await createPerson('Mo', world.mallory.id)
      await setPeopleAccess({ readScope: 'OWN', canCreate: true, updateScope: 'OWN' })

      const { options } = await optionsGet(
        asMallory({ params: optionsParams(world.relationFieldId) }),
      )
      expect(options.map((option) => option.id)).toEqual([mine.id])

      await expect(patchRecord({ owner: theirs.id })).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Owner: you can only link to your own records',
      })
      await expect(patchRecord({ owner: mine.id })).resolves.toMatchObject({
        record: { data: { owner: mine.id } },
      })
    })

    it('keeps a link someone else made to a record out of the role’s sight', async () => {
      const theirs = await createPerson('Ada', world.ada.id)
      await linkTo(theirs.id)
      await setPeopleAccess({ readScope: 'OWN' })

      await expect(patchRecord({ company: 'Beta', owner: theirs.id })).resolves.toMatchObject({
        record: { data: { company: 'Beta', owner: theirs.id } },
      })
    })
  })
})

describe('a role scoped to its own records', () => {
  const recordEvent = (
    method: 'GET' | 'PATCH' | 'DELETE',
    recordAddress: string,
    extra: { body?: unknown; ifMatch?: string } = {},
  ) => {
    const event = testEvent({
      user: world.mallory,
      method,
      body: extra.body,
      params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId, recordAddress },
    })
    if (extra.ifMatch) event.node.req.headers['if-match'] = extra.ifMatch
    return event
  }
  const tableEvent = (body?: unknown) =>
    testEvent({
      user: world.mallory,
      method: body === undefined ? 'GET' : 'POST',
      body,
      params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId },
    })

  /** Mallory joins as an Editor narrowed to `access`; Ada's record is Ada's, and Mallory adds one. */
  async function joinScoped(access: Partial<ITableAccess>) {
    await setRoleTableAccess(
      world.ada.workspace.id,
      'Editor',
      world.tableId,
      buildTableAccess({ canCreate: true, ...access }),
    )
    await prisma.record.update({
      where: { id: world.recordId },
      data: { createdById: world.ada.id },
    })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Editor')

    const { record } = await recordsPost(tableEvent({ company: 'Mine' }))
    return record
  }

  const own = { readScope: 'OWN', updateScope: 'OWN', deleteScope: 'OWN' } as const

  it('lists, counts and opens only the records they created', async () => {
    const mine = await joinScoped(own)

    const page = await recordsGet(tableEvent())
    expect(page.records.map((record) => record.id)).toEqual([mine.id])
    expect(page.total).toBe(1)

    await expect(recordGet(recordEvent('GET', world.recordId))).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(recordGet(recordEvent('GET', mine.id))).resolves.toMatchObject({
      record: { id: mine.id, createdById: world.mallory.id },
    })
  })

  it('withholds the table’s record count, which would tell them how many others hold', async () => {
    await joinScoped(own)
    const people = await prisma.table.findFirstOrThrow({
      where: { workspaceId: world.ada.workspace.id, name: 'People' },
      select: { id: true },
    })
    await setRoleTableAccess(world.ada.workspace.id, 'Editor', people.id, buildTableAccess())

    const { tables } = await tablesGet(
      testEvent({ user: world.mallory, params: { workspaceAddress: adaWorkspace() } }),
    )
    expect(tables.find((table) => table.id === world.tableId)?._count.records).toBeNull()
    expect(tables.find((table) => table.name === 'People')?._count.records).toBe(0)
  })

  it('refuses a record they read but did not create with 403, one they cannot read with 404', async () => {
    const mine = await joinScoped({ updateScope: 'OWN', deleteScope: 'OWN' })
    const body = { company: 'Beta' }

    await expect(recordPatch(recordEvent('PATCH', world.recordId, { body }))).rejects.toMatchObject(
      { statusCode: 403, statusMessage: 'You can only edit your own records' },
    )
    await expect(recordDelete(recordEvent('DELETE', world.recordId))).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'You can only delete your own records',
    })
    await expect(recordPatch(recordEvent('PATCH', mine.id, { body }))).resolves.toMatchObject({
      record: { data: body },
    })

    await prisma.roleTableAccess.updateMany({
      where: { tableId: world.tableId, role: { name: 'Editor' } },
      data: { readScope: 'OWN' },
    })
    await expect(recordPatch(recordEvent('PATCH', world.recordId, { body }))).rejects.toMatchObject(
      { statusCode: 404 },
    )
    await expect(recordDelete(recordEvent('DELETE', world.recordId))).rejects.toMatchObject({
      statusCode: 404,
    })

    await expect(prisma.record.count({ where: { tableId: world.tableId } })).resolves.toBe(2)
  })

  it('checks the scope before the version: 403 for another’s record, 412 for a stale own one', async () => {
    const mine = await joinScoped({ updateScope: 'OWN' })
    const theirs = await prisma.record.findUniqueOrThrow({ where: { id: world.recordId } })
    const body = { company: 'Beta' }

    await expect(
      recordPatch(
        recordEvent('PATCH', theirs.id, { body, ifMatch: `"${theirs.updatedAt.toISOString()}"` }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      recordPatch(recordEvent('PATCH', mine.id, { body, ifMatch: '"2000-01-01T00:00:00.000Z"' })),
    ).rejects.toMatchObject({ statusCode: 412 })
  })

  it('reaches no record without an author, which belongs to no one', async () => {
    await joinScoped(own)
    await prisma.record.update({ where: { id: world.recordId }, data: { createdById: null } })

    await expect(recordGet(recordEvent('GET', world.recordId))).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

function tableEndpoint(name: string): IEndpoint {
  const endpoint = scopedEndpoints().find((candidate) => candidate.name === name)
  if (!endpoint) throw new Error(`No endpoint named ${name}`)
  return endpoint
}

/** Opens Deals and People to a role, by name, as `access` says. */
async function grantWorldTables(roleName: string, access: Partial<ITableAccess>) {
  const tables = await prisma.table.findMany({
    where: { workspaceId: world.ada.workspace.id },
    select: { id: true },
  })
  for (const table of tables) {
    await setRoleTableAccess(world.ada.workspace.id, roleName, table.id, buildTableAccess(access))
  }
}

/** A role form's row for Deals: reading every record unless `access` says more. */
const dealsRow = (access: Partial<ITableAccess>) => [
  { tableId: world.tableId, ...buildTableAccess(access) },
]

describe('a member who manages roles stays within their own permissions', () => {
  beforeEach(async () => {
    await prisma.workspaceRole.create({
      data: {
        workspaceId: world.ada.workspace.id,
        name: 'Manager',
        permissions: ['ROLES_MANAGE'],
      },
    })
    await grantWorldTables('Manager', { canCreate: true })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Manager')
  })

  const roleEvent = (method: 'POST' | 'PUT' | 'DELETE', body?: unknown, roleId?: string) =>
    testEvent({
      user: world.mallory,
      method,
      body,
      params: { workspaceAddress: adaWorkspace(), ...(roleId ? { roleId } : {}) },
    })

  const adminRoleId = async () =>
    (
      await prisma.workspaceRole.findUniqueOrThrow({
        where: { workspaceId_name: { workspaceId: world.ada.workspace.id, name: 'Admin' } },
        select: { id: true },
      })
    ).id

  it('creates a role from what they hold', async () => {
    await expect(
      rolesPost(roleEvent('POST', buildRoleInput('Clerk', [], dealsRow({ canCreate: true })))),
    ).resolves.toMatchObject({ role: { name: 'Clerk' } })
  })

  it.each([
    ['a permission', () => buildRoleInput('Boss', ['TABLES_MANAGE'])],
    ['a record action', () => buildRoleInput('Boss', [], dealsRow({ deleteScope: 'ALL' }))],
  ])('cannot create a role granting %s they lack', async (_, buildBody) => {
    await expect(rolesPost(roleEvent('POST', buildBody()))).rejects.toMatchObject({
      statusCode: 403,
    })
    await expect(prisma.workspaceRole.findFirst({ where: { name: 'Boss' } })).resolves.toBeNull()
  })

  it.each([
    ['a permission', () => buildRoleInput('Viewer', ['MEMBERS_MANAGE'])],
    ['a record action', () => buildRoleInput('Viewer', [], dealsRow({ updateScope: 'ALL' }))],
  ])('cannot raise a role they could edit above themselves by %s', async (_, buildBody) => {
    await expect(rolePut(roleEvent('PUT', buildBody(), world.viewerRoleId))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('cannot change or delete a role above them', async () => {
    const adminId = await adminRoleId()

    await expect(rolePut(roleEvent('PUT', buildRoleInput('Admin'), adminId))).rejects.toMatchObject(
      { statusCode: 403 },
    )
    await expect(roleDelete(roleEvent('DELETE', undefined, adminId))).rejects.toMatchObject({
      statusCode: 403,
    })
    await expect(
      prisma.workspaceRole.findUniqueOrThrow({ where: { id: adminId } }),
    ).resolves.toMatchObject({ permissions: expect.arrayContaining(['TABLES_MANAGE']) })
  })
})

describe('a member who manages members stays within their own permissions', () => {
  beforeEach(async () => {
    await prisma.workspaceRole.create({
      data: {
        workspaceId: world.ada.workspace.id,
        name: 'Manager',
        permissions: ['MEMBERS_INVITE', 'MEMBERS_MANAGE'],
      },
    })
    await grantWorldTables('Manager', { canCreate: true })
    await addMember(world.ada.workspace.id, world.mallory.id, 'Manager')
  })

  const managerEvent = (
    method: 'POST' | 'PATCH' | 'DELETE',
    params: Record<string, string>,
    body?: unknown,
  ) =>
    testEvent({
      user: world.mallory,
      method,
      body,
      params: { workspaceAddress: adaWorkspace(), ...params },
    })

  const findRoleId = async (name: string) =>
    (
      await prisma.workspaceRole.findUniqueOrThrow({
        where: { workspaceId_name: { workspaceId: world.ada.workspace.id, name } },
        select: { id: true },
      })
    ).id

  it('invites as a role within their permissions, never above them', async () => {
    await expect(
      invitationsPost(
        managerEvent('POST', {}, { email: 'Clerk@Example.com', roleId: world.viewerRoleId }),
      ),
    ).resolves.toMatchObject({ invitation: { email: 'clerk@example.com' } })

    await expect(
      invitationsPost(
        managerEvent('POST', {}, { email: 'boss@example.com', roleId: await findRoleId('Admin') }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('cannot touch the owner, nor raise a member above themselves', async () => {
    const grace = await createUser('grace@example.com')
    const graceMember = await addMember(world.ada.workspace.id, grace.id, 'Viewer')

    await expect(
      memberDelete(managerEvent('DELETE', { memberId: world.adaMemberId })),
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      memberPatch(
        managerEvent('PATCH', { memberId: graceMember.id }, { roleId: await findRoleId('Admin') }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 })

    await expect(
      memberDelete(managerEvent('DELETE', { memberId: graceMember.id })),
    ).resolves.toEqual({ ok: true })
  })
})

describe('an anonymous request is 401 before anything else', () => {
  it('on every endpoint, including ones whose ids do not exist', async () => {
    const endpoints: THandler[] = [
      workspacesGet,
      workspacesPost,
      incomingInvitationsGet,
      incomingInvitationAccept,
      incomingInvitationDecline,
      ...scopedEndpoints().map((endpoint) => endpoint.handler),
    ]

    for (const handler of endpoints) {
      const event = testEvent({
        params: {
          workspaceAddress: 'nope',
          tableAddress: 'nope',
          fieldId: 'nope',
          recordAddress: 'nope',
          roleId: 'nope',
          memberId: 'nope',
          invitationId: 'nope',
        },
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }
  })
})

describe('the workspaces a user sees', () => {
  it('lists only their memberships, with what each lets them do', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Editor')

    const { memberships } = await workspacesGet(testEvent({ user: world.mallory }))

    expect(memberships).toHaveLength(2)
    expect(memberships[0]).toMatchObject({
      workspace: { publicId: world.mallory.workspace.publicId },
      isOwner: true,
      role: { name: 'Admin' },
    })
    expect(memberships[1]).toMatchObject({
      workspace: { publicId: adaWorkspace() },
      isOwner: false,
      role: { name: 'Editor' },
      permissions: [],
    })
  })

  it('remembers the last workspace, but only one they can still open', async () => {
    const membership = await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')
    await workspaceVisitPut(
      testEvent({
        user: world.mallory,
        method: 'PUT',
        params: { workspaceAddress: adaWorkspace() },
      }),
    )
    await expect(workspacesGet(testEvent({ user: world.mallory }))).resolves.toMatchObject({
      lastWorkspaceAddress: adaWorkspace(),
    })

    await prisma.workspaceMember.delete({ where: { id: membership.id } })
    await expect(workspacesGet(testEvent({ user: world.mallory }))).resolves.toMatchObject({
      lastWorkspaceAddress: null,
    })
  })
})

describe('managing a workspace', () => {
  const workspaceEvent = (user: TSeededUser, method: 'PATCH' | 'DELETE', body?: unknown) =>
    testEvent({ user, method, body, params: { workspaceAddress: adaWorkspace() } })

  it('creates one the caller owns, validated by the shared schema', async () => {
    await expect(
      workspacesPost(testEvent({ user: world.mallory, method: 'POST', body: { name: '  ' } })),
    ).rejects.toMatchObject({ statusCode: 400 })

    const { membership } = await workspacesPost(
      testEvent({ user: world.mallory, method: 'POST', body: { name: 'Side project' } }),
    )

    expect(membership).toMatchObject({ isOwner: true, workspace: { name: 'Side project' } })
  })

  it('lets an Admin who is not the owner rename it, but never delete it', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Admin')

    await expect(
      workspacePatch(workspaceEvent(world.mallory, 'PATCH', { name: 'Renamed' })),
    ).resolves.toMatchObject({ workspace: { name: 'Renamed' } })

    await expect(workspaceDelete(workspaceEvent(world.mallory, 'DELETE'))).rejects.toMatchObject({
      statusCode: 403,
    })
    await expect(prisma.workspace.count({ where: { id: world.ada.workspace.id } })).resolves.toBe(1)
  })

  it('lets the owner delete it, after which it is a 404 to everyone', async () => {
    await addMember(world.ada.workspace.id, world.mallory.id, 'Viewer')

    await expect(workspaceDelete(workspaceEvent(world.ada, 'DELETE'))).resolves.toEqual({
      ok: true,
    })

    for (const user of [world.ada, world.mallory]) {
      await expect(
        workspaceGet(testEvent({ user, params: { workspaceAddress: adaWorkspace() } })),
      ).rejects.toMatchObject({ statusCode: 404, data: { missing: 'workspace' } })
    }
  })
})

describe('a relation cannot be pointed across workspaces', () => {
  it('404s when the target table belongs to another workspace', async () => {
    const theirs = await createTable(world.mallory.workspace.id, 'Theirs')
    await createField(theirs.id, { key: 'full_name', type: 'TEXT' })

    const event = testEvent({
      user: world.ada,
      params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId },
      method: 'POST',
      body: {
        name: 'Stolen',
        type: 'RELATION',
        targetTableId: theirs.id,
        labelFieldKey: 'full_name',
      },
    })

    await expect(fieldsPost(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('400s when the label field is not one the target table has', async () => {
    const people = await createTable(world.ada.workspace.id, 'More People')
    await createField(people.id, { key: 'full_name', type: 'TEXT' })

    const event = testEvent({
      user: world.ada,
      params: { workspaceAddress: adaWorkspace(), tableAddress: world.tableId },
      method: 'POST',
      body: {
        name: 'Bad label',
        type: 'RELATION',
        targetTableId: people.id,
        labelFieldKey: 'no_such_field',
      },
    })

    await expect(fieldsPost(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field to show for the link',
    })
  })
})

describe('a table is addressable by its number as well as by its cuid', () => {
  const get = (user: TSeededUser, workspaceAddress: string, tableAddress: string) =>
    tableGet(testEvent({ user, params: { workspaceAddress, tableAddress } }))

  it('answers identically either way', async () => {
    const table = await createTable(world.ada.workspace.id, 'Addressed')

    const byCuid = await get(world.ada, adaWorkspace(), table.id)
    const byNumber = await get(world.ada, adaWorkspace(), String(table.number))

    expect(byNumber).toEqual(byCuid)
    expect(byNumber.table.id).toBe(table.id)
  })

  it('404s on a number only another workspace has', async () => {
    await createTable(world.mallory.workspace.id, 'One')
    await createTable(world.mallory.workspace.id, 'Two')
    const theirs = await createTable(world.mallory.workspace.id, 'Three')

    await expect(get(world.ada, adaWorkspace(), String(theirs.number))).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })

  it('gives each workspace its own table 1', async () => {
    const hers = await createTable(world.mallory.workspace.id, 'Hers')

    const ada = await get(world.ada, adaWorkspace(), '1')
    const mallory = await get(world.mallory, world.mallory.workspace.publicId, '1')

    expect(ada.table.name).toBe('Deals')
    expect(mallory.table.id).toBe(hers.id)
  })

  it('reaches a table’s fields and records by number too', async () => {
    const number = String((await createTable(world.ada.workspace.id, 'Numbered')).number)
    const params = { workspaceAddress: adaWorkspace(), tableAddress: number }

    await expect(fieldsGet(testEvent({ user: world.ada, params }))).resolves.toMatchObject({
      fields: [],
    })
    await expect(recordsGet(testEvent({ user: world.ada, params }))).resolves.toMatchObject({
      records: [],
      total: 0,
    })
  })
})
