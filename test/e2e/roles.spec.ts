import type { Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { confirmDeletion, expect, test } from '~~/test/e2e/setup/fixtures'

const roleRow = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })

test.beforeEach(async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/settings/roles`)
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible()
})

test('lists the default roles with what each may do', async ({ page, seedTable }) => {
  await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }], [])
  await page.reload()

  await expect(roleRow(page, 'Admin')).toContainText('Every permission, Records in 1 table')
  await expect(roleRow(page, 'Admin')).toContainText('your role')
  await expect(roleRow(page, 'Viewer')).toContainText('Records in 1 table')
})

test('a role is created closed to every table, opened to one, and deleted', async ({
  page,
  seedTable,
  workspace,
}) => {
  const deals = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }], [])
  await page.getByRole('link', { name: 'New role' }).click()
  await page.getByLabel('Role name').fill('Sales')
  await expect(page.getByRole('button', { name: /^Sees records in Deals/ })).toHaveAccessibleName(
    'Sees records in Deals None',
  )
  await page.getByRole('button', { name: 'Create role' }).click()

  await expect(roleRow(page, 'Sales')).toContainText('0 members')
  await expect(roleRow(page, 'Sales')).toContainText('No tables')

  await page.getByRole('link', { name: /^Sales/ }).click()
  await expect(page.getByLabel('Role name')).toHaveValue('Sales')
  await page.getByRole('button', { name: /^Sees records in Deals/ }).click()
  await page.getByRole('option', { name: 'All' }).click()
  await page.getByRole('button', { name: /^Edits records in Deals/ }).click()
  await page.getByRole('option', { name: 'Only own' }).click()
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Role saved.' })).toBeVisible()

  const sales = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Sales' } },
    select: { tableAccess: { select: { tableId: true, readScope: true, updateScope: true } } },
  })
  expect(sales.tableAccess).toEqual([{ tableId: deals.id, readScope: 'ALL', updateScope: 'OWN' }])

  await page.getByRole('link', { name: 'All roles' }).click()
  await expect(roleRow(page, 'Sales')).toContainText('Records in 1 table')

  await page.getByRole('link', { name: /^Sales/ }).click()
  await page.getByRole('button', { name: 'Delete role' }).click()
  await confirmDeletion(page)

  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible()
  await expect(roleRow(page, 'Sales')).toHaveCount(0)
})

test('a role someone holds offers no delete, and says what to do instead', async ({ page }) => {
  await page.getByRole('link', { name: /^Admin/ }).click()

  await expect(page.getByText('1 member has this role')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete role' })).toHaveCount(0)
})

test('a taken name is refused on save', async ({ page }) => {
  await page.getByRole('link', { name: 'New role' }).click()
  await page.getByLabel('Role name').fill('Editor')
  await page.getByRole('button', { name: 'Create role' }).click()

  await expect(page.getByRole('alert')).toContainText('A role with this name already exists')
})

test('a role’s table and field access is set and saved from the keyboard', async ({
  page,
  seedTable,
  workspace,
}) => {
  const deals = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }], [])
  await page.goto(`${workspace.url}/settings/roles`)
  await page.getByRole('link', { name: /^Viewer/ }).click()
  await expect(page.getByRole('heading', { name: 'Viewer' })).toBeVisible()

  const open = page.getByRole('button', { name: 'Deals', exact: true })
  await open.focus()
  await page.keyboard.press('Enter')
  await expect(open).toHaveAttribute('aria-expanded', 'true')

  const company = page.getByRole('button', { name: /^Company in Deals/ })
  await company.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('option', { name: 'Hidden' })).toBeVisible()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect(company).toHaveAccessibleName('Company in Deals Hidden')

  const sees = page.getByRole('button', { name: /^Sees records in Deals/ })
  await sees.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('option', { name: 'Only own' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(sees).toHaveAccessibleName('Sees records in Deals Only own')
  await expect(page.getByText('Unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Save role' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Role saved.' })).toBeVisible()

  const viewer = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Viewer' } },
    select: {
      tableAccess: { select: { tableId: true, readScope: true } },
      fieldAccess: { select: { access: true } },
    },
  })
  expect(viewer.tableAccess).toEqual([{ tableId: deals.id, readScope: 'OWN' }])
  expect(viewer.fieldAccess).toEqual([{ access: 'HIDDEN' }])
})
