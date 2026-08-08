import { vi, type Mock } from 'vitest'

/**
 * A stand-in for the Prisma singleton, so the five modules that import it are reachable from
 * the fast `unit` project at all: `server/utils/prisma.ts` constructs a real `PrismaClient` at
 * module load, and `record-query.ts` is unit-testable today precisely because it is the one
 * service that does not import it.
 *
 * What a stub can prove is the code *around* a query — which guard fires, what shape the
 * `where` clause is built in, how many queries are issued. What it cannot prove is that the
 * query runs, or that the database agrees with it. That half is deliberately left to the
 * integration stage rather than faked here (`CLAUDE.md` §10).
 */
interface IModelMock {
  findMany: Mock
  findUnique: Mock
  findFirst: Mock
  create: Mock
  update: Mock
  delete: Mock
}

function modelMock(): IModelMock {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

export const prismaMock = {
  table: modelMock(),
  field: modelMock(),
  record: modelMock(),
  user: modelMock(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

/**
 * Both call forms are in use — a callback for the writes that must move together, an array for
 * the list query and its count — so the stub answers to both rather than forcing each spec to
 * hand-roll one. The callback receives the mock *itself* as its `tx`, which is what lets a
 * transactional write and a direct one be asserted through the same spy.
 */
function installTransaction(): void {
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : Promise.resolve((arg as (tx: typeof prismaMock) => unknown)(prismaMock)),
  )
}

installTransaction()

/** Call from `beforeEach` — clears recorded calls and stubbed results, keeping `$transaction`. */
export function resetPrismaMock(): void {
  for (const model of [prismaMock.table, prismaMock.field, prismaMock.record, prismaMock.user]) {
    for (const method of Object.values(model)) method.mockReset()
  }

  prismaMock.$queryRaw.mockReset()
  prismaMock.$executeRaw.mockReset()
  prismaMock.$transaction.mockReset()
  installTransaction()
}
