import type { Browser, Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { expect, signInNewUser, test, type ISeededTable } from '~~/test/e2e/setup/fixtures'

/** A second account, joined to the e2e user's workspace under one of its roles. */
async function signInAsMember(browser: Browser, workspaceId: string, roleName: string) {
  const { page, email } = await signInNewUser(browser)

  await prisma.workspaceMember.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      user: { connect: { email } },
      role: { connect: { workspaceId_name: { workspaceId, name: roleName } } },
    },
  })

  return page
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Your tables' })

let table: ISeededTable

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable(
    'Deals',
    [{ key: 'company', type: 'TEXT', name: 'Company' }],
    [{ company: 'Acme' }],
  )
})

test('an Editor works with records but sees no control over the schema', async ({
  browser,
  workspace,
}) => {
  const page = await signInAsMember(browser, workspace.id, 'Editor')

  await page.goto(table.url)
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add record' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit record' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible()
  await expect(sidebar(page).getByRole('button', { name: 'Add a table' })).toHaveCount(0)

  await page.goto(table.settingsUrl)
  await expect(page.getByText('Company', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add field' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit field Company' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete table' })).toHaveCount(0)

  await page.context().close()
})

test('a Viewer reads everything and is offered no change at all', async ({
  browser,
  workspace,
}) => {
  const page = await signInAsMember(browser, workspace.id, 'Viewer')

  await page.goto(table.url)
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View record' })).toBeVisible()
  for (const name of ['Add record', 'Edit record', 'More actions']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }

  await page.goto(`${workspace.url}/settings/roles`)
  await expect(page.getByRole('button', { name: 'New role' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Edit role/ })).toHaveCount(0)

  await page.context().close()
})

test('a role narrowed mid-session hides its controls on the first refusal', async ({
  browser,
  workspace,
}) => {
  const page = await signInAsMember(browser, workspace.id, 'Editor')
  await page.goto(table.url)
  await page.getByRole('button', { name: 'Edit record' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await prisma.workspaceRole.update({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Editor' } },
    data: { permissions: [] },
  })

  await dialog.getByLabel('Company').fill('Acme Ltd')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(dialog).toContainText("You don't have permission to edit records")
  await expect(page.getByRole('button', { name: 'Add record' })).toHaveCount(0)

  await page.context().close()
})

test('a member removed mid-session lands on the workspace’s 404, and home no longer offers it', async ({
  browser,
  workspace,
}) => {
  const page = await signInAsMember(browser, workspace.id, 'Editor')
  await page.goto(table.url)
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete record' }).click()

  await prisma.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id, user: { name: 'Member' } },
  })
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('We couldn’t find that workspace.')).toBeVisible()

  await page.getByRole('button', { name: 'Back to home' }).click()
  await expect(page).not.toHaveURL(new RegExp(workspace.publicId))

  await page.context().close()
})
