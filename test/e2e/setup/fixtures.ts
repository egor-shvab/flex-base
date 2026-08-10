import { test as base, expect } from '@playwright/test'
import { prisma } from '#server/utils/prisma'
import type { IField, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'
import { createField, createFields, createRecords, createTable } from '~~/test/integration/seed'

/**
 * Seeded metadata handed to a spec — enough to reach any page by URL without clicking through
 * the setup flow first. `table-setup.spec.ts` is the one file that builds a table by hand;
 * everywhere else that would be ceremony in front of the behaviour under test.
 */
export interface ISeededTable {
  id: string
  name: string
  fields: IField[]
  url: string
}

interface IFieldSeed {
  key: string
  type: TFieldType
  name?: string
  required?: boolean
  options?: IField['options']
}

interface IFixtures {
  /** The signed-in account's id, for seeding rows it owns. */
  userId: string
  seedTable: (name: string, fields: IFieldSeed[], rows?: TRecordData[]) => Promise<ISeededTable>
  /** Console errors the page logged, asserted empty where a spec cares. */
  consoleErrors: string[]
}

async function currentUserId(): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
  return user.id
}

export const test = base.extend<IFixtures>({
  /**
   * Every case starts from an empty workspace. `User` is spared — the storage state in
   * `playwright.config.ts` holds that account's cookie, and truncating it would sign the
   * whole suite out.
   */
  // Playwright reads a fixture's dependencies off its destructuring pattern, so it insists on
  // one even where — as here — there are none to declare
  // eslint-disable-next-line no-empty-pattern
  userId: async ({}, use) => {
    await prisma.$executeRawUnsafe('TRUNCATE "Table", "Field", "Record" CASCADE')
    await use(await currentUserId())
  },

  seedTable: async ({ userId }, use) => {
    await use(async (name, fields, rows = []) => {
      const table = await createTable(userId, name)
      const created = await createFields(
        table.id,
        fields.map((field, index) => ({ ...field, order: index })),
      )
      await createRecords(table.id, rows)

      return {
        id: table.id,
        name: table.name,
        fields: created,
        url: `/tables/${table.id}/records`,
      }
    })
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await use(errors)
  },
})

/**
 * Confirms a pending deletion, scoped to the dialog.
 *
 * Never `getByRole('button', { name: /^Delete/ }).last()`: `ConfirmModal` is lazy-loaded, so on
 * a cold chunk cache that locator resolves *before* the dialog mounts and clicks the last row's
 * own Delete button instead — which opens a different dialog and makes the case fail
 * intermittently, dependent on nothing but whether the chunk was already fetched.
 */
export async function confirmDeletion(page: import('@playwright/test').Page): Promise<void> {
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  // `Delet` rather than `Delete`: the button reads "Deleting…" while the request is in flight
  await dialog.getByRole('button', { name: /^Delet/ }).click()
}

export { expect, createField, createRecords, prisma }
