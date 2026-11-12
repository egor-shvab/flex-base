import type { Page } from '@playwright/test'
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
  await dialog.getByLabel('Edit records').check()
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(roleRow(page, 'Sales')).toContainText('Add records, Edit records')

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
