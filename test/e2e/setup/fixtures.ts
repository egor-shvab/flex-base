import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import type { IField, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'
import { createField, createFields, createRecords, createTable } from '~~/test/integration/seed'
import { E2E_USER } from '~~/test/e2e/setup/global-setup'

export interface ISeededTable {
  id: string
  /** Never assume 1: the truncate spares `User`, so `tableCounter` climbs across the run. */
  number: number
  name: string
  fields: IField[]
  url: string
  settingsUrl: string
}

interface IFieldSeed {
  key: string
  type: TFieldType
  name?: string
  required?: boolean
  options?: IField['options']
}

interface IFixtures {
  userId: string
  seedTable: (name: string, fields: IFieldSeed[], rows?: TRecordData[]) => Promise<ISeededTable>
  consoleErrors: string[]
}

/** By identity: `findFirst` promises no order, and the sign-up case registers a second user. */
async function currentUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: E2E_USER.email },
    select: { id: true },
  })
  return user.id
}

export const test = base.extend<IFixtures>({
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
        number: table.number,
        name: table.name,
        fields: created,
        url: `/tables/${table.number}`,
        settingsUrl: `/tables/${table.number}/settings`,
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
 * Scoped to the dialog: `ConfirmModal` is lazy, so an unscoped `.last()` can resolve before it
 * mounts and click a row's own Delete.
 */
export async function confirmDeletion(page: import('@playwright/test').Page): Promise<void> {
  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
}

export async function openRecordForm(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.getByRole('button', { name: 'Add record' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

export const companies = (page: Page): Promise<string[]> =>
  page.locator('tbody tr td:nth-child(2)').allInnerTexts()

/** Polled: rows refetch asynchronously after the URL has already moved. */
export const expectCompanies = (page: Page, expected: string[]) =>
  expect.poll(() => companies(page)).toEqual(expected)

export { expect, createField, createRecords, prisma }
