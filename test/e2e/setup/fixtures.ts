import { test as base, expect } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { DEFAULT_WORKSPACE_ROLES } from '#server/db/workspaces'
import type { IField, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'
import { createField, createFields, createRecords, createTable } from '~~/test/integration/seed'
import { E2E_USER } from '~~/test/e2e/setup/global-setup'

/** Where `/` lands the e2e user: their personal workspace's home. */
export const WORKSPACE_HOME = /\/w\/[a-z0-9]{10}$/

export interface ISeededWorkspace {
  id: string
  publicId: string
  url: string
}

export interface ISeededTable {
  id: string
  /** Never assume 1: the truncate spares the workspace, so `tableCounter` climbs across the run. */
  number: number
  name: string
  workspaceAddress: string
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
  workspace: ISeededWorkspace
  seedTable: (name: string, fields: IFieldSeed[], rows?: TRecordData[]) => Promise<ISeededTable>
  consoleErrors: string[]
}

/**
 * By identity: the sign-up case registers a second user. The oldest is the personal one; any a
 * case created is removed, as is any member, invitation or role it added, and any workspace the
 * user joined or handed over; the default roles get their permissions back, and `/` is pointed
 * back at it.
 */
async function resetToPersonalWorkspace(): Promise<ISeededWorkspace> {
  const owner = { email: E2E_USER.email }
  const workspace = await prisma.workspace.findFirstOrThrow({
    where: { owner },
    orderBy: { createdAt: 'asc' },
    select: { id: true, publicId: true },
  })

  await prisma.workspace.deleteMany({ where: { owner, id: { not: workspace.id } } })
  await prisma.workspaceMember.deleteMany({
    where: {
      OR: [
        { workspaceId: workspace.id, user: { isNot: owner } },
        { user: owner, workspace: { owner: { isNot: owner } } },
      ],
    },
  })
  await prisma.workspaceInvitation.deleteMany({
    where: { OR: [{ workspaceId: workspace.id }, { email: E2E_USER.email.toLowerCase() }] },
  })
  await prisma.workspaceRole.deleteMany({
    where: {
      workspaceId: workspace.id,
      name: { notIn: DEFAULT_WORKSPACE_ROLES.map((role) => role.name) },
    },
  })
  for (const role of DEFAULT_WORKSPACE_ROLES) {
    await prisma.workspaceRole.update({
      where: { workspaceId_name: { workspaceId: workspace.id, name: role.name } },
      data: { permissions: [...role.permissions] },
    })
  }
  await prisma.user.update({ where: owner, data: { lastWorkspaceId: workspace.id } })

  return { ...workspace, url: `/w/${workspace.publicId}` }
}

export const test = base.extend<IFixtures>({
  // eslint-disable-next-line no-empty-pattern
  workspace: async ({}, use) => {
    await prisma.$executeRawUnsafe('TRUNCATE "Table", "Field", "Record" CASCADE')
    await use(await resetToPersonalWorkspace())
  },

  seedTable: async ({ workspace }, use) => {
    await use(async (name, fields, rows = []) => {
      const table = await createTable(workspace.id, name)
      const created = await createFields(
        table.id,
        fields.map((field, index) => ({ ...field, order: index })),
      )
      await createRecords(table.id, rows)

      return {
        id: table.id,
        number: table.number,
        name: table.name,
        workspaceAddress: workspace.publicId,
        fields: created,
        url: `${workspace.url}/tables/${table.number}`,
        settingsUrl: `${workspace.url}/tables/${table.number}/settings`,
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

let userSequence = 0

/**
 * Another person, registered through the API as they would be, signed in in a context of their
 * own. They start with nothing but their personal workspace.
 */
export async function signInNewUser(browser: Browser): Promise<{ page: Page; email: string }> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  userSequence += 1
  const email = `member-${test.info().workerIndex}-${userSequence}-${Date.now()}@example.com`

  const registered = await page.request.post('/api/auth/register', {
    data: { name: 'Member', email, password: 'correct-horse-battery' },
  })
  expect(registered.ok()).toBe(true)

  return { page, email }
}

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
