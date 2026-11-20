import process from 'node:process'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { reconcileFieldIndexes } from '#server/db/field-indexes'
import { PERSONAL_WORKSPACE_NAME, createWorkspaceWithOwner } from '#server/db/workspaces'
import { hashPassword } from '#server/utils/auth'
import type { IField } from '#shared/types/field'
import { compileDataset } from '~~/prisma/seed/compile'
import {
  DEMO_AUTHORS,
  DEMO_MEMBERS,
  DEMO_PASSWORD,
  DEMO_ROLES,
  DEMO_WORKSPACE_NAME,
  RETIRED_SEED_EMAILS,
} from '~~/prisma/seed/demo-team'
import { idFor } from '~~/prisma/seed/ids'
import { SEED_TABLES } from '~~/prisma/seed/dataset'
import type { ICompiledRecord, ICompiledTable } from '~~/prisma/seed/compile'

/**
 * The only destructive statements delete the demo accounts' rows, never a `TRUNCATE`: this runs
 * against the development database. The display counters are set by hand, having no database
 * default.
 */

const OWNER = DEMO_MEMBERS[0]!
const DEMO_WORKSPACE_ADDRESS = idFor(`workspace:${OWNER.email}`).slice(1, 11)

function requireSeedTable(tables: ICompiledTable[], name: string): ICompiledTable {
  const table = tables.find((candidate) => candidate.name === name)
  if (!table) throw new Error(`The seed has no table named ${name}`)
  return table
}

function requireSeedField(table: ICompiledTable, name: string): IField {
  const field = table.fields.find((candidate) => candidate.name === name)
  if (!field) throw new Error(`The seed has no field named ${name} in ${table.name}`)
  return field
}

/** A table is closed to a role without a row, so every role is given its tables here. */
async function grantDemoAccess(
  workspaceId: string,
  tables: ICompiledTable[],
  roleIdByName: ReadonlyMap<string, string>,
): Promise<void> {
  const roleIdFor = (name: string) => {
    const roleId = roleIdByName.get(name)
    if (!roleId) throw new Error(`The workspace has no role named ${name}`)
    return roleId
  }

  await prisma.roleTableAccess.createMany({
    data: DEMO_ROLES.flatMap((role) =>
      Object.entries(role.tables).map(([tableName, access]) => ({
        workspaceId,
        roleId: roleIdFor(role.name),
        tableId: requireSeedTable(tables, tableName).id,
        ...access,
      })),
    ),
  })
  await prisma.roleFieldAccess.createMany({
    data: DEMO_ROLES.flatMap((role) =>
      role.fields.map((row) => ({
        workspaceId,
        roleId: roleIdFor(role.name),
        fieldId: requireSeedField(requireSeedTable(tables, row.table), row.field).id,
        access: row.access,
      })),
    ),
  })
}

/** A record's author: the member `DEMO_AUTHORS` names for it, or else the owner. */
function buildAuthorFor(ownerId: string) {
  return (table: ICompiledTable, record: ICompiledRecord): string => {
    const author = DEMO_AUTHORS.find(
      (entry) => entry.table === table.name && record.number % entry.every === entry.offset,
    )
    return author ? idFor(`user:${author.email}`) : ownerId
  }
}

function assertSeedableEnvironment(): void {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    throw new Error('DATABASE_URL is not set. Copy `.env.example` to `.env` first.')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a demo account with NODE_ENV=production.')
  }
}

async function writeTable(
  workspaceId: string,
  authorFor: (table: ICompiledTable, record: ICompiledRecord) => string,
  table: ICompiledTable,
): Promise<void> {
  await prisma.table.create({
    data: {
      id: table.id,
      workspaceId,
      name: table.name,
      number: table.number,
      recordCounter: table.records.length,
      recordCount: table.records.length,
    },
  })

  await prisma.field.createMany({
    data: table.fields.map((field) => ({
      id: field.id,
      tableId: table.id,
      name: field.name,
      key: field.key,
      type: field.type,
      required: field.required,
      options: (field.options as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
      order: field.order,
      indexed: field.indexed,
    })),
  })

  if (table.records.length === 0) return

  await prisma.record.createMany({
    data: table.records.map((record) => ({
      id: record.id,
      tableId: table.id,
      number: record.number,
      data: record.data as Prisma.InputJsonObject,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: authorFor(table, record),
      updatedById: authorFor(table, record),
    })),
  })
}

async function seed(): Promise<void> {
  assertSeedableEnvironment()

  const tables = compileDataset(SEED_TABLES)

  const seededEmails = [...DEMO_MEMBERS.map((member) => member.email), ...RETIRED_SEED_EMAILS]

  // The owners' workspaces first: `Workspace.ownerId` restricts deleting the user
  await prisma.workspace.deleteMany({ where: { owner: { email: { in: seededEmails } } } })
  await prisma.user.deleteMany({ where: { email: { in: seededEmails } } })

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const ownerId = idFor(`user:${OWNER.email}`)

  const { workspaceId, roleIdByName } = await prisma.$transaction(async (tx) => {
    await tx.user.createMany({
      data: DEMO_MEMBERS.map((member) => ({
        id: idFor(`user:${member.email}`),
        email: member.email,
        name: member.name,
        passwordHash,
      })),
    })

    const created = await createWorkspaceWithOwner(tx, {
      ownerId,
      name: DEMO_WORKSPACE_NAME,
    })
    // A fixed address, so a bookmark survives a reseed; hex is within the address alphabet
    const workspace = await tx.workspace.update({
      where: { id: created.workspace.id },
      data: { publicId: DEMO_WORKSPACE_ADDRESS, tableCounter: tables.length },
      select: { id: true },
    })

    // The workspace starts with the owner's role alone; the demo's other roles join it
    await tx.workspaceRole.createMany({
      data: DEMO_ROLES.filter((role) => role.name !== created.role.name).map((role) => ({
        workspaceId: workspace.id,
        name: role.name,
        permissions: [...role.permissions],
      })),
    })
    const roles = await tx.workspaceRole.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
    })
    const roleIdByName = new Map(roles.map((role) => [role.name, role.id]))

    await tx.workspaceMember.createMany({
      data: DEMO_MEMBERS.slice(1).map((member) => ({
        workspaceId: workspace.id,
        userId: idFor(`user:${member.email}`),
        roleId: roleIdByName.get(member.roleName)!,
      })),
    })
    // The owner joined under Admin when the workspace was made
    if (OWNER.roleName !== 'Admin') {
      await tx.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: ownerId } },
        data: { roleId: roleIdByName.get(OWNER.roleName)! },
      })
    }

    // Every account owns a personal workspace, as registration leaves it
    for (const member of DEMO_MEMBERS.slice(1)) {
      await createWorkspaceWithOwner(tx, {
        ownerId: idFor(`user:${member.email}`),
        name: PERSONAL_WORKSPACE_NAME,
      })
    }
    await tx.user.updateMany({
      where: { id: { in: DEMO_MEMBERS.map((member) => idFor(`user:${member.email}`)) } },
      data: { lastWorkspaceId: workspace.id },
    })

    return { workspaceId: workspace.id, roleIdByName }
  })

  const authorFor = buildAuthorFor(ownerId)
  for (const table of tables) await writeTable(workspaceId, authorFor, table)
  await grantDemoAccess(workspaceId, tables, roleIdByName)

  // `CONCURRENTLY` is refused inside a transaction, and nothing else indexes a directly inserted
  // field
  const indexes = await reconcileFieldIndexes()

  const report = [
    `Seeded ${DEMO_WORKSPACE_NAME} at /w/${DEMO_WORKSPACE_ADDRESS}; every account's password is ${DEMO_PASSWORD}`,
    ...DEMO_MEMBERS.map(
      (member, index) =>
        `  ${member.email.padEnd(20)} ${member.name.padEnd(16)} ${member.roleName}` +
        (index === 0 ? ', owner' : ''),
    ),
    ...tables.map(
      (table) =>
        `  ${table.name.padEnd(18)} ${String(table.records.length).padStart(4)} records, ` +
        `${table.fields.length} fields`,
    ),
    `  ${'Indexes'.padEnd(18)} ${indexes.created.length} created, ${indexes.dropped.length} dropped` +
      (indexes.reaped.length > 0 ? `, ${indexes.reaped.length} reaped` : ''),
  ]

  process.stdout.write(`${report.join('\n')}\n`)
}

try {
  await seed()
} finally {
  await prisma.$disconnect()
}
