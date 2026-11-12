import type { Page } from '@playwright/test'
import { expect, test } from '~~/test/e2e/setup/fixtures'

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Your tables' })

/** Named by its content, which ends with the caller's role: the e2e user owns every workspace. */
const switcher = (page: Page) => sidebar(page).getByRole('button', { name: /Owner$/ })

async function openSwitcher(page: Page) {
  await switcher(page).click()
  await expect(page.getByRole('menu', { name: 'Workspaces' })).toBeVisible()
}

async function createWorkspace(page: Page, name: string) {
  await openSwitcher(page)
  await page.getByRole('menuitem', { name: 'Create workspace' }).click()
  await page.getByLabel('Workspace name').fill(name)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(switcher(page)).toContainText(name)
}

test.beforeEach(async ({ seedTable }) => {
  await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])
})

test('a new workspace opens empty, and switching back brings its tables', async ({
  page,
  workspace,
}) => {
  await page.goto(workspace.url)
  await expect(sidebar(page).getByRole('link', { name: /Deals/ })).toBeVisible()

  await createWorkspace(page, 'Side project')

  await expect(page).not.toHaveURL(workspace.url)
  await expect(page.getByText('No tables yet', { exact: true })).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: /Deals/ })).toHaveCount(0)

  await openSwitcher(page)
  await page.getByRole('menuitemradio', { name: /Personal workspace/ }).click()

  await expect(page).toHaveURL(workspace.url)
  await expect(sidebar(page).getByRole('link', { name: /Deals/ })).toBeVisible()
})

test('the switcher is keyboard-operable, and Escape closes only it', async ({
  page,
  workspace,
}) => {
  await page.goto(workspace.url)
  await switcher(page).focus()

  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: /Personal workspace/ })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Create workspace' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(switcher(page)).toBeFocused()
})

test('a workspace is renamed in its settings', async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/settings`)
  await expect(page).toHaveURL(`${workspace.url}/settings/general`)

  await page.getByLabel('Workspace name').fill('Acme Sales')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('main').getByRole('status')).toHaveText('Changes saved.')
  await expect(switcher(page)).toContainText('Acme Sales')

  await page.reload()
  await expect(page.getByLabel('Workspace name')).toHaveValue('Acme Sales')
})

test('deleting a workspace asks for its name, then opens another', async ({ page, workspace }) => {
  await page.goto(workspace.url)
  await createWorkspace(page, 'Doomed')

  await sidebar(page).getByRole('link', { name: 'Workspace settings' }).click()
  await page.getByRole('link', { name: 'Danger zone' }).click()
  await page.getByRole('button', { name: 'Delete workspace' }).click()

  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Delete workspace' })
  await expect(confirm).toBeDisabled()

  await dialog.getByLabel('Type “Doomed” to confirm').fill('Doomed')
  await confirm.click()

  await expect(page).toHaveURL(workspace.url)
  await openSwitcher(page)
  await expect(page.getByRole('menuitemradio')).toHaveCount(1)
  await expect(page.getByRole('menuitemradio', { name: /Doomed/ })).toHaveCount(0)
})
