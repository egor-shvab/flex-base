import type { Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { confirmDeletion, expect, test } from '~~/test/e2e/setup/fixtures'

const roleRow = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })

test.beforeEach(async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/settings/roles`)
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible()
})

test('lists the default roles with what each may do', async ({ page }) => {
  await expect(roleRow(page, 'Admin')).toContainText('Every permission')
  await expect(roleRow(page, 'Admin')).toContainText('your role')
  await expect(roleRow(page, 'Editor')).toContainText('Add records, Edit records, Delete records')
  await expect(roleRow(page, 'Viewer')).toContainText('Read only')
})

test('a role is created, changed and deleted', async ({ page }) => {
  await page.getByRole('button', { name: 'New role' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Role name').fill('Sales')
  await dialog.getByLabel('Add records').check()
  await dialog.getByRole('button', { name: 'Create role' }).click()

  await expect(dialog).toHaveCount(0)
  await expect(roleRow(page, 'Sales')).toContainText('0 members')
  await expect(roleRow(page, 'Sales')).toContainText('Add records')

  await page.getByRole('button', { name: 'Edit role Sales' }).click()
  await expect(dialog.getByLabel('Add records')).toBeChecked()
  await dialog.getByRole('button', { name: /^Records they can edit/ }).click()
  await page.getByRole('option', { name: 'Only their own' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(roleRow(page, 'Sales')).toContainText('Add records, Edit own records')

  await page.getByRole('button', { name: 'Delete role Sales' }).click()
  await confirmDeletion(page)

  await expect(roleRow(page, 'Sales')).toHaveCount(0)
})

test('a role someone holds cannot be deleted', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete role Admin' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(dialog).toContainText(
    'Reassign the members of this role and revoke its invitations first',
  )
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(roleRow(page, 'Admin')).toBeVisible()
})

test('a taken name is refused in the form', async ({ page }) => {
  await page.getByRole('button', { name: 'New role' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Role name').fill('Editor')
  await dialog.getByRole('button', { name: 'Create role' }).click()

  await expect(dialog).toContainText('A role with this name already exists')
})

test('a role’s table and field access is set and saved from the keyboard', async ({
  page,
  seedTable,
  workspace,
}) => {
  const deals = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }], [])
  await page.goto(`${workspace.url}/settings/roles`)
  await page.getByRole('link', { name: 'Table and field access of Viewer' }).click()
  await expect(page.getByRole('heading', { name: 'Access of Viewer' })).toBeVisible()

  const expand = page.getByRole('button', { name: 'Set access for Deals' })
  await expand.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Close for Deals' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Own setting for this table')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Own setting for this table')).toBeChecked()

  const company = page.getByRole('button', { name: /^Company access/ })
  await company.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('option', { name: 'Hidden' })).toBeVisible()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect(company).toHaveAccessibleName('Company access Hidden')

  await page.getByRole('button', { name: 'Save access' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Access saved.' })).toBeVisible()

  const viewer = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Viewer' } },
    select: {
      tableAccess: { select: { tableId: true } },
      fieldAccess: { select: { access: true } },
    },
  })
  expect(viewer.tableAccess).toEqual([{ tableId: deals.id }])
  expect(viewer.fieldAccess).toEqual([{ access: 'HIDDEN' }])
})
