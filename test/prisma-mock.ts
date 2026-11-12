import { vi, type Mock } from 'vitest'

interface IModelMock {
  findMany: Mock
  findUnique: Mock
  findUniqueOrThrow: Mock
  findFirst: Mock
  findFirstOrThrow: Mock
  count: Mock
  create: Mock
  upsert: Mock
  update: Mock
  delete: Mock
  deleteMany: Mock
}

function modelMock(): IModelMock {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  }
}

export const prismaMock = {
  table: modelMock(),
  field: modelMock(),
  record: modelMock(),
  user: modelMock(),
  workspace: modelMock(),
  workspaceMember: modelMock(),
  workspaceRole: modelMock(),
  workspaceInvitation: modelMock(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

/** The callback form receives the mock itself as `tx`, so both forms share the same spies. */
function installTransaction(): void {
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : Promise.resolve((arg as (tx: typeof prismaMock) => unknown)(prismaMock)),
  )
}

installTransaction()

export function resetPrismaMock(): void {
  const models = [
    prismaMock.table,
    prismaMock.field,
    prismaMock.record,
    prismaMock.user,
    prismaMock.workspace,
    prismaMock.workspaceMember,
    prismaMock.workspaceRole,
    prismaMock.workspaceInvitation,
  ]

  for (const model of models) {
    for (const method of Object.values(model)) method.mockReset()
  }

  prismaMock.$queryRaw.mockReset()
  prismaMock.$executeRaw.mockReset()
  prismaMock.$transaction.mockReset()
  installTransaction()
}
