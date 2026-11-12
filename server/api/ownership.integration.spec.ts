import { beforeEach, describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import workspacesGet from '#server/api/workspaces/index.get'
import workspaceGet from '#server/api/workspaces/[workspaceAddress]/index.get'
import workspaceVisitPut from '#server/api/workspaces/[workspaceAddress]/visit.put'
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
import type { TWorkspaceAccess } from '#server/utils/workspace-access'
import { testEvent } from '~~/test/integration/event'
import {
  addMember,
  createField,
  createRecord,
  createTable,
  createUser,
  type TSeededUser,
} from '~~/test/integration/seed'

type THandler = (event: H3Event) => unknown

interface IWorld {
  ada: TSeededUser
  mallory: TSeededUser
  tableId: string
  fieldId: string
  relationFieldId: string
  recordId: string
}

interface IEndpoint {
  name: string
  handler: THandler
  access: TWorkspaceAccess
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

  world = {
    ada,
    mallory,
    tableId: table.id,
    fieldId: field.id,
    relationFieldId: relation.id,
    recordId: record.id,
  }
})

const adaWorkspace = () => world.ada.workspace.publicId

function scopedEndpoints(workspaceAddress = adaWorkspace()): IEndpoint[] {
  const { tableId, fieldId, relationFieldId, recordId } = world
  const workspaceParams = { workspaceAddress }
  const tableParams = { workspaceAddress, tableAddress: tableId }
  const fieldParams = { ...tableParams, fieldId }
  const recordParams = { ...tableParams, recordAddress: recordId }
  const validField = { name: 'Renamed', type: 'TEXT' }

  return [
    { name: 'GET /workspaces/:ws', handler: workspaceGet, access: 'READ', params: workspaceParams },
    {
      name: 'PUT /workspaces/:ws/visit',
      handler: workspaceVisitPut,
      access: 'READ',
      params: workspaceParams,
      method: 'PUT',
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
      access: 'RECORDS_CREATE',
      params: tableParams,
      body: { company: 'Beta' },
      method: 'POST',
    },
    { name: 'GET /records/:id', handler: recordGet, access: 'READ', params: recordParams },
    {
      name: 'PATCH /records/:id',
      handler: recordPatch,
      access: 'RECORDS_UPDATE',
      params: recordParams,
      body: { company: 'Beta' },
      method: 'PATCH',
    },
    {
      name: 'DELETE /records/:id',
      handler: recordDelete,
      access: 'RECORDS_DELETE',
      params: recordParams,
      method: 'DELETE',
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
    ['Viewer', [] as TWorkspaceAccess[]],
    ['Editor', ['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE'] as TWorkspaceAccess[]],
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

describe('an anonymous request is 401 before anything else', () => {
  it('on every endpoint, including ones whose ids do not exist', async () => {
    const endpoints: THandler[] = [
      workspacesGet,
      ...scopedEndpoints().map((endpoint) => endpoint.handler),
    ]

    for (const handler of endpoints) {
      const event = testEvent({
        params: {
          workspaceAddress: 'nope',
          tableAddress: 'nope',
          fieldId: 'nope',
          recordAddress: 'nope',
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
      permissions: ['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE'],
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
