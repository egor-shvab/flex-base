import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
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
        url: `/tables/${table.id}`,
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

/**
 * The record form, opened the way a user opens it. Shared because both `BaseSelect` spec files
 * reach their controls through it — a select is only interesting once it is inside a form.
 */
export async function openRecordForm(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.getByRole('button', { name: 'Add record' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/**
 * The Company column, which every list spec reads to say which rows came back.
 *
 * Positional on purpose, and one of the documented exceptions in `CLAUDE.md` §10: a *column*
 * is not a thing a user targets, so no role names it. `getByRole('cell')` would return every
 * cell of every column, which is not what a filter assertion is about.
 */
export const companies = (page: Page): Promise<string[]> =>
  page.locator('tbody tr td:nth-child(2)').allInnerTexts()

/**
 * Polled, never read once: a URL change resolves the moment the address bar moves, but the
 * rows behind it are refetched asynchronously — reading straight after would assert on the
 * previous query's results often enough to be flaky and never enough to be noticed.
 */
export const expectCompanies = (page: Page, expected: string[]) =>
  expect.poll(() => companies(page)).toEqual(expected)

export { expect, createField, createRecords, prisma }
