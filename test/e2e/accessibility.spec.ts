import type { Locator, Page } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { expect, test } from '~~/test/e2e/setup/fixtures'
import { axeViolations, undersizedTargets } from '~~/test/e2e/setup/a11y'
import { E2E_USER } from '~~/test/e2e/setup/global-setup'
import { createUser } from '~~/test/integration/seed'

const FIELDS = [
  { key: 'company', type: 'TEXT' as const, name: 'Company' },
  { key: 'contract_value', type: 'NUMBER' as const, name: 'Contract value' },
  { key: 'active', type: 'BOOLEAN' as const, name: 'Active' },
  {
    key: 'stage',
    type: 'SELECT' as const,
    name: 'Stage',
    options: {
      choices: [
        { value: 'Won', color: 'green' as const },
        { value: 'Lost', color: 'red' as const },
      ],
    },
  },
]

const ROWS = [{ company: 'Acme', contract_value: 100, active: true, stage: 'Won' }]

const IN_A_WEEK = () => new Date(Date.now() + 7 * 86_400_000)

/** Someone else, with a workspace of their own, unique across workers and runs. */
const createStranger = () =>
  createUser(`stranger-${test.info().workerIndex}-${Date.now()}@example.com`)

/** A member who can be managed and an invitation to revoke, so every row control renders. */
async function seedMembersOf(workspaceId: string) {
  const stranger = await createStranger()
  const editor = await prisma.workspaceRole.findUniqueOrThrow({
    where: { workspaceId_name: { workspaceId, name: 'Editor' } },
    select: { id: true },
  })
  await prisma.workspaceMember.create({
    data: { workspaceId, userId: stranger.id, roleId: editor.id },
  })
  await prisma.workspaceInvitation.create({
    data: { workspaceId, email: 'invited@example.com', roleId: editor.id, expiresAt: IN_A_WEEK() },
  })
}

test.describe('the app screens', () => {
  let url = ''
  let settingsUrl = ''
  let workspaceUrl = ''
  let workspaceId = ''

  test.beforeEach(async ({ seedTable, workspace }) => {
    const table = await seedTable('Deals', FIELDS, ROWS)
    url = table.url
    settingsUrl = table.settingsUrl
    workspaceUrl = workspace.url
    workspaceId = workspace.id
  })

  const screens: Record<string, (page: Page) => Promise<void>> = {
    dashboard: async (page) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
    },
    'table settings': async (page) => {
      await page.goto(settingsUrl)
      await expect(page.getByRole('heading', { name: 'Deals' })).toBeVisible()
    },
    'records list': async (page) => {
      await page.goto(url)
      await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
    },
    'the record form': async (page) => {
      await page.goto(url)
      await page.getByRole('button', { name: 'Add record' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    'the filter drawer': async (page) => {
      await page.goto(url)
      await page.getByRole('button', { name: 'Filters' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    'the workspace switcher': async (page) => {
      await page.goto(workspaceUrl)
      await page.getByRole('button', { name: /Owner$/ }).click()
      await expect(page.getByRole('menu', { name: 'Workspaces' })).toBeVisible()
    },
    'workspace settings': async (page) => {
      await page.goto(`${workspaceUrl}/settings/general`)
      await expect(page.getByLabel('Workspace name')).toBeVisible()
    },
    'workspace roles': async (page) => {
      await page.goto(`${workspaceUrl}/settings/roles`)
      await expect(page.getByRole('button', { name: 'Edit role Viewer' })).toBeVisible()
    },
    'the role form': async (page) => {
      await page.goto(`${workspaceUrl}/settings/roles`)
      await page.getByRole('button', { name: 'New role' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    'workspace members': async (page) => {
      await seedMembersOf(workspaceId)
      await page.goto(`${workspaceUrl}/settings/members`)
      await expect(page.getByRole('button', { name: /^Revoke invitation/ })).toBeVisible()
    },
    'the invitation form': async (page) => {
      await page.goto(`${workspaceUrl}/settings/members`)
      await page.getByRole('button', { name: 'Invite member' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    'the transfer form': async (page) => {
      await seedMembersOf(workspaceId)
      await page.goto(`${workspaceUrl}/settings/danger`)
      await page.getByRole('button', { name: 'Transfer ownership' }).click()
      await expect(page.getByRole('dialog').getByLabel('New owner')).toBeVisible()
    },
    'incoming invitations': async (page) => {
      const stranger = await createStranger()
      const viewer = await prisma.workspaceRole.findUniqueOrThrow({
        where: { workspaceId_name: { workspaceId: stranger.workspace.id, name: 'Viewer' } },
        select: { id: true },
      })
      await prisma.workspaceInvitation.create({
        data: {
          workspaceId: stranger.workspace.id,
          email: E2E_USER.email,
          roleId: viewer.id,
          invitedById: stranger.id,
          expiresAt: IN_A_WEEK(),
        },
      })
      await page.goto('/invitations')
      await expect(page.getByRole('button', { name: /^Accept the invitation/ })).toBeVisible()
    },
    'the workspace danger zone': async (page) => {
      await page.goto(`${workspaceUrl}/settings/danger`)
      await page.getByRole('button', { name: 'Delete workspace' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  }

  for (const [name, open] of Object.entries(screens)) {
    test(`${name} has no serious or critical accessibility violations`, async ({ page }) => {
      await open(page)

      expect(await axeViolations(page)).toEqual([])
    })

    test(`${name} has no target below 24×24`, async ({ page }) => {
      await open(page)

      expect(await undersizedTargets(page)).toEqual([])
    })
  }
})

test.describe('the component showcase', () => {
  const SUBPAGES = ['buttons', 'inputs', 'select', 'display', 'navigation', 'overlays']

  for (const subpage of SUBPAGES) {
    const open = async (page: Page) => {
      await page.goto(`/ui-test/${subpage}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }

    test(`/ui-test/${subpage} has no serious or critical accessibility violations`, async ({
      page,
    }) => {
      await open(page)

      expect(await axeViolations(page)).toEqual([])
    })

    test(`/ui-test/${subpage} has no target below 24×24`, async ({ page }) => {
      await open(page)

      expect(await undersizedTargets(page)).toEqual([])
    })
  }
})

const FOCUS = 'rgb(44, 150, 101)'
const HALO = '230, 242, 235'

const focusState = (locator: Locator) =>
  locator.evaluate((element) => {
    const { outlineStyle, outlineWidth, outlineColor, boxShadow, borderColor } =
      getComputedStyle(element)
    return {
      outlineStyle,
      width: Number.parseFloat(outlineWidth),
      outlineColor,
      boxShadow,
      borderColor,
    }
  })

test('a focused field recolours its border, and takes no ring', async ({ page, seedTable }) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(table.url)
  const search = page.getByRole('textbox', { name: 'Search this table' })
  await search.focus()

  const state = await focusState(search)

  expect(state.borderColor).toBe(FOCUS)
  expect(state.outlineStyle).toBe('none')
  expect(state.boxShadow).toContain(HALO)
})

test('a focused button takes the ring, since it has no border to recolour', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(table.url)
  // `:focus-visible` does not match a script focus after a click
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: 'Add record' }).first().focus()

  const state = await focusState(page.getByRole('button', { name: 'Add record' }).first())

  expect(state.outlineStyle).toBe('solid')
  expect(state.width).toBeGreaterThan(0)
  expect(state.outlineColor).toBe(FOCUS)
  expect(state.boxShadow).toContain(HALO)
})

test('the filter-summary chip’s remove button sits exactly on the floor', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(`${table.url}?stage=Won`)

  const remove = page.getByRole('button', { name: /Remove the Stage filter/i })
  const box = await remove.boundingBox()

  expect(box).not.toBeNull()
  expect(Math.round(box!.width)).toBe(24)
  expect(Math.round(box!.height)).toBe(24)
})
