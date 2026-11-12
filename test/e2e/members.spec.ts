import type { Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { createWorkspaceWithDefaults } from '#server/db/workspaces'
import { E2E_USER } from '~~/test/e2e/setup/global-setup'
import { expect, signInNewUser, test, WORKSPACE_HOME } from '~~/test/e2e/setup/fixtures'

const listRow = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

async function inviteFromMembersPage(page: Page, email: string, roleName: string) {
  await page.getByRole('button', { name: 'Invite member' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email address').fill(email)
  await dialog.getByLabel('Role').click()
  await page.getByRole('option', { name: roleName, exact: true }).click()
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(dialog).toHaveCount(0)
}

test('an invited person joins, works under the role given, and loses access once removed', async ({
  browser,
  page,
  workspace,
  seedTable,
}) => {
  const table = await seedTable(
    'Deals',
    [{ key: 'company', type: 'TEXT', name: 'Company' }],
    [{ company: 'Acme' }],
  )
  const invitee = await signInNewUser(browser)

  await page.goto(`${workspace.url}/settings/members`)
  await inviteFromMembersPage(page, invitee.email.toUpperCase(), 'Editor')
  await expect(listRow(page, invitee.email)).toContainText('Editor')

  const other = invitee.page
  await other.goto('/')
  await other.getByRole('button', { name: /1 invitation waiting/ }).click()
  await other.getByRole('menuitem', { name: /Invitations/ }).click()
  await expect(other).toHaveURL(/\/invitations$/)
  await other.getByRole('button', { name: /^Accept the invitation to/ }).click()

  await expect(other).toHaveURL(new RegExp(`/w/${workspace.publicId}$`))
  await expect(
    other.getByRole('navigation', { name: 'Your tables' }).getByRole('link', { name: /Deals/ }),
  ).toBeVisible()

  await page.reload()
  const memberRow = listRow(page, invitee.email)
  await memberRow.getByRole('button', { name: 'Role of Member' }).click()
  await page.getByRole('option', { name: 'Viewer', exact: true }).click()
  await expect(memberRow).toContainText('Viewer')

  await other.goto(table.url)
  await expect(other.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Add record' })).toHaveCount(0)

  await memberRow.getByRole('button', { name: 'Remove Member' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove member' }).click()
  await expect(listRow(page, invitee.email)).toHaveCount(0)

  await other.reload()
  await expect(other.getByText('We couldn’t find that workspace.')).toBeVisible()

  await other.context().close()
})

test('a revoked invitation can no longer be accepted', async ({ browser, page, workspace }) => {
  const invitee = await signInNewUser(browser)

  await page.goto(`${workspace.url}/settings/members`)
  await inviteFromMembersPage(page, invitee.email, 'Viewer')

  const other = invitee.page
  await other.goto('/invitations')
  await expect(other.getByText(`${E2E_USER.name} invited you as Viewer`)).toBeVisible()

  await page.getByRole('button', { name: `Revoke invitation for ${invitee.email}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke invitation' }).click()
  await expect(page.getByText('Nobody is waiting to join.')).toBeVisible()

  await other.getByRole('button', { name: /^Accept the invitation to/ }).click()
  await expect(other.getByRole('alert')).toContainText('This invitation is no longer valid')
  await expect(other.getByText('No invitations are waiting for you.')).toBeVisible()

  await other.context().close()
})

test('the owner hands a workspace over, then leaves it', async ({ browser, page }) => {
  const newcomer = await signInNewUser(browser)
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: E2E_USER.email },
    select: { id: true },
  })
  const { workspace } = await prisma.$transaction((tx) =>
    createWorkspaceWithDefaults(tx, { ownerId: owner.id, name: 'Handover' }),
  )
  await prisma.workspaceMember.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { email: newcomer.email } },
      role: { connect: { workspaceId_name: { workspaceId: workspace.id, name: 'Editor' } } },
    },
  })

  await page.goto(`/w/${workspace.publicId}/settings/danger`)
  await page.getByRole('button', { name: 'Transfer ownership' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('New owner').click()
  await page.getByRole('option', { name: 'Member · Editor' }).click()
  await dialog.getByRole('button', { name: 'Transfer ownership' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.getByRole('button', { name: 'Delete workspace' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Leave workspace' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Leave workspace' }).click()

  await expect(page).toHaveURL(WORKSPACE_HOME)
  await expect(page).not.toHaveURL(new RegExp(workspace.publicId))
  await page.getByRole('button', { name: /Owner$/ }).click()
  await expect(page.getByRole('menu', { name: 'Workspaces' })).not.toContainText('Handover')

  await newcomer.page.goto(`/w/${workspace.publicId}/settings/danger`)
  await expect(newcomer.page.getByRole('button', { name: 'Delete workspace' })).toBeVisible()

  await newcomer.page.context().close()
})
