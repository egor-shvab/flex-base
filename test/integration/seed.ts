import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { PERSONAL_WORKSPACE_NAME, createWorkspaceWithDefaults } from '#server/db/workspaces'
import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'
import type { ITableAccess } from '#shared/types/workspace'
import { buildTableAccess } from '~~/test/membership'

let sequence = 0

const unique = (prefix: string) => `${prefix}_${(sequence += 1)}`

/** A user as registration leaves them: owner of a personal workspace with the default roles. */
export function createUser(email = `${unique('user')}@example.com`) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: email.split('@')[0] ?? email, passwordHash: 'not-a-real-hash' },
      select: { id: true, email: true, name: true },
    })
    const { workspace, role } = await createWorkspaceWithDefaults(tx, {
      ownerId: user.id,
      name: PERSONAL_WORKSPACE_NAME,
    })

    return {
      ...user,
      workspace: { id: workspace.id, publicId: workspace.publicId, ownerRoleId: role.id },
    }
  })
}

export type TSeededUser = Awaited<ReturnType<typeof createUser>>

/** Joins `userId` to the workspace under one of its roles, by name. */
export function addMember(workspaceId: string, userId: string, roleName: string) {
  return prisma.workspaceMember.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      user: { connect: { id: userId } },
      role: { connect: { workspaceId_name: { workspaceId, name: roleName } } },
    },
    select: { id: true },
  })
}

/**
 * What the default roles reach in a table the rig creates, so a spec about something else need not
 * open each table to them: a table without a row is closed to a role.
 */
const DEFAULT_ROLE_TABLE_ACCESS: Record<string, ITableAccess> = {
  Admin: FULL_TABLE_ACCESS,
  Editor: FULL_TABLE_ACCESS,
  Viewer: buildTableAccess(),
}

export async function createTable(workspaceId: string, name = unique('Table')) {
  const { tableCounter } = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { tableCounter: { increment: 1 } },
    select: { tableCounter: true },
  })

  const table = await prisma.table.create({
    data: { workspaceId, name, number: tableCounter },
    select: { id: true, number: true, name: true, createdAt: true, updatedAt: true },
  })
  const roles = await prisma.workspaceRole.findMany({
    where: { workspaceId, name: { in: Object.keys(DEFAULT_ROLE_TABLE_ACCESS) } },
    select: { id: true, name: true },
  })
  await prisma.roleTableAccess.createMany({
    data: roles.map((role) => ({
      workspaceId,
      roleId: role.id,
      tableId: table.id,
      ...DEFAULT_ROLE_TABLE_ACCESS[role.name]!,
    })),
  })
  return table
}

/** Sets what a role, by name, may do with one table's records, replacing any row it had. */
export async function setTableAccess(
  workspaceId: string,
  roleName: string,
  tableId: string,
  access: ITableAccess,
) {
  const { id: roleId } = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId, name: roleName } },
    select: { id: true },
  })
  await prisma.roleTableAccess.upsert({
    where: { roleId_tableId: { roleId, tableId } },
    create: { workspaceId, roleId, tableId, ...access },
    update: access,
  })
}

interface IFieldSeed {
  key: string
  type: TFieldType
  name?: string
  required?: boolean
  options?: IFieldOptions | null
  order?: number
  indexed?: boolean
}

export async function createField(tableId: string, seed: IFieldSeed): Promise<IField> {
  const field = await prisma.field.create({
    data: {
      tableId,
      key: seed.key,
      name: seed.name ?? seed.key,
      type: seed.type,
      required: seed.required ?? false,
      options: (seed.options as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      order: seed.order ?? 0,
      indexed: seed.indexed ?? false,
    },
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      required: true,
      options: true,
      order: true,
      indexed: true,
    },
  })

  return { ...field, options: (field.options as IFieldOptions | null) ?? null }
}

export function createFields(tableId: string, seeds: IFieldSeed[]): Promise<IField[]> {
  return seeds.reduce<Promise<IField[]>>(
    async (previous, seed, index) => [
      ...(await previous),
      await createField(tableId, { order: index, ...seed }),
    ],
    Promise.resolve([]),
  )
}

/** Settable only on create: `updatedAt` is `@updatedAt`, which Prisma overwrites on update. */
interface IRecordTimestamps {
  createdAt?: Date
  updatedAt?: Date
}

export async function createRecord(
  tableId: string,
  data: TRecordData = {},
  timestamps: IRecordTimestamps = {},
) {
  const { recordCounter } = await prisma.table.update({
    where: { id: tableId },
    data: { recordCounter: { increment: 1 }, recordCount: { increment: 1 } },
    select: { recordCounter: true },
  })

  return prisma.record.create({
    data: {
      tableId,
      number: recordCounter,
      data: data as Prisma.InputJsonObject,
      ...timestamps,
    },
    select: { id: true, number: true, data: true, createdAt: true, updatedAt: true },
  })
}

export function createRecords(tableId: string, rows: TRecordData[]) {
  return rows.reduce<Promise<{ id: string; number: number }[]>>(
    async (previous, row) => [...(await previous), await createRecord(tableId, row)],
    Promise.resolve([]),
  )
}
