import { WORKSPACE_HOME, expect, test } from '~~/test/e2e/setup/fixtures'
import { axeViolations, undersizedTargets } from '~~/test/e2e/setup/a11y'

/** Playwright's visibility honours `visibility: hidden`, so translated-but-focusable fails here. */
test.use({ viewport: { width: 375, height: 812 } })

const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Show tables' })

const sidebar = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Your tables' })

/** The shell locks the document, so a row too wide scrolls `main` sideways, never the page. */
const mainPaneOverflow = (page: import('@playwright/test').Page) =>
  page.getByRole('main').evaluate((pane) => Math.max(0, pane.scrollWidth - pane.clientWidth))

let recordsUrl = ''
let settingsUrl = ''

test.beforeEach(async ({ seedTable }) => {
  const table = await seedTable(
    'Deals',
    [
      { key: 'company', type: 'TEXT', name: 'Company' },
      { key: 'contract_value', type: 'NUMBER', name: 'Contract value' },
      { key: 'active', type: 'BOOLEAN', name: 'Active' },
      {
        key: 'stage',
        type: 'SELECT',
        name: 'Stage',
        options: {
          choices: [
            { value: 'Won', color: 'green' },
            { value: 'Lost', color: 'red' },
          ],
        },
      },
    ],
    [{ company: 'Acme', contract_value: 100, active: true, stage: 'Won' }, { company: 'Beta' }],
  )
  recordsUrl = table.url
  settingsUrl = table.settingsUrl
})

test('the sidebar is off-screen and unreachable until it is asked for', async ({ page }) => {
  await page.goto('/')

  await expect(sidebar(page)).toBeHidden()
  await expect(sidebar(page).getByRole('link', { name: /Deals/ })).toBeHidden()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
})

test('the toggle opens it, and says so', async ({ page }) => {
  await page.goto('/')

  await toggle(page).click()

  await expect(sidebar(page)).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: /Deals/ })).toBeVisible()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
})

test('the open panel is anchored to the top of the viewport', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()
  await expect(sidebar(page)).toBeVisible()

  const box = await sidebar(page).boundingBox()
  const viewport = page.viewportSize()

  expect(box).not.toBeNull()
  expect(box!.y).toBe(0)
  expect(box!.height).toBe(viewport?.height)
})

test('navigating through it dismisses it', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()

  await sidebar(page).getByRole('link', { name: /Deals/ }).click()

  await expect(page).toHaveURL(/\/tables\/[^/]+$/)
  await expect(sidebar(page)).toBeHidden()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
})

test('the scrim behind it dismisses it without navigating', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()
  await expect(sidebar(page)).toBeVisible()

  const scrim = page.locator('.app-layout__scrim')
  const box = await scrim.boundingBox()
  await scrim.click({ position: { x: box!.width - 20, y: box!.height / 2 } })

  await expect(sidebar(page)).toBeHidden()
  await expect(page).toHaveURL(WORKSPACE_HOME)
})

test('Escape dismisses it when nothing covers it', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()
  await expect(sidebar(page)).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(sidebar(page)).toBeHidden()
  await expect(page).toHaveURL(WORKSPACE_HOME)
})

test('Escape closes a dialog over it without also closing it', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()
  await sidebar(page).getByRole('button', { name: 'Add a table' }).click()

  const dialog = page.getByRole('dialog', { name: 'New table' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  // `aria-expanded` first: the panel closes behind a transition, so visibility would resolve
  // mid-slide
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar(page)).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(sidebar(page)).toBeHidden()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
})

test('the records table scrolls inside itself, not the page', async ({ page }) => {
  await page.goto(recordsUrl)
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Not set' }).first()).toBeAttached()

  const pageOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(pageOverflows).toBe(false)
})

test('a record row keeps one action, and its menu holds the rest', async ({ page }) => {
  await page.goto(recordsUrl)
  const row = page.getByRole('row').filter({ hasText: 'Acme' })

  await expect(row.getByRole('link', { name: 'View record' })).toBeHidden()
  await expect(row.getByRole('button', { name: 'Edit record' })).toBeHidden()

  await row.getByRole('button', { name: 'More actions' }).click()
  const menu = page.getByRole('menu', { name: 'Record actions' })
  await expect(menu.getByRole('menuitem')).toHaveText([
    'View record',
    'Edit record',
    'Delete record',
  ])
  await expect(menu.getByRole('menuitem', { name: 'View record' })).toBeFocused()

  await menu.getByRole('menuitem', { name: 'View record' }).click()

  await expect(page.getByRole('dialog', { name: 'Record details' })).toContainText('Acme')
})

test('the page head is one row: the step back, the title and its actions', async ({ page }) => {
  await page.goto(recordsUrl)

  const title = page.getByRole('heading', { level: 1, name: 'Deals' })
  const [titleBox, backBox, settingsBox, addBox] = await Promise.all([
    title.boundingBox(),
    page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Home' })
      .boundingBox(),
    page.getByRole('link', { name: 'Settings' }).boundingBox(),
    page.getByRole('button', { name: 'Add record' }).boundingBox(),
  ])
  const middle = titleBox!.y + titleBox!.height / 2

  for (const box of [backBox, settingsBox, addBox]) {
    expect(box!.y).toBeLessThan(middle)
    expect(box!.y + box!.height).toBeGreaterThan(middle)
  }
  expect(await mainPaneOverflow(page)).toBe(0)
})

test('the filters drawer sorts by any column, through the same URL', async ({ page }) => {
  await page.goto(recordsUrl)
  await page.getByRole('button', { name: 'Filters' }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })

  await drawer.getByRole('button', { name: /^Sort by/ }).click()
  await page.getByRole('option', { name: 'Company' }).click()
  await drawer.getByRole('radio', { name: 'Ascending' }).click()

  await expect(page).toHaveURL(/sort=company/)
  await expect(page).toHaveURL(/dir=asc/)
  await drawer.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('row').nth(1)).toContainText('Acme')
})

test('a dialog fits the viewport and keeps its actions reachable', async ({ page }) => {
  await page.goto(recordsUrl)
  await page.getByRole('button', { name: 'Add record' }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()

  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1)
  await expect(dialog.getByRole('button', { name: 'Create record' })).toBeVisible()
})

/**
 * `toBeInViewport`, never `toBeVisible`: content scrolled out of a container still counts as
 * visible.
 */
test('a dialog taller than the screen scrolls its body instead of overflowing', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable(
    'Wide',
    Array.from({ length: 15 }, (_, index) => ({
      key: `field_${index}`,
      type: 'TEXT' as const,
      name: `Field ${index}`,
    })),
  )

  await page.goto(table.url)
  await page.getByRole('button', { name: 'Add record' }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()

  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1)

  const title = dialog.getByRole('heading', { name: 'New record' })
  await expect(title).toBeInViewport()

  const body = dialog.locator('.base-modal__body')
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(
    true,
  )

  const submit = dialog.getByRole('button', { name: 'Create record' })
  await expect(submit).toBeInViewport()
  await expect(title).toBeInViewport()
})

test.describe('the gates at this width', () => {
  for (const [name, url] of [
    ['the dashboard', () => '/'],
    ['the records list', () => recordsUrl],
    ['the table settings page', () => settingsUrl],
  ] as const) {
    test(`${name} has no serious or critical violations`, async ({ page }) => {
      await page.goto(url())

      expect(await axeViolations(page)).toEqual([])
    })

    test(`${name} has no target below 24×24`, async ({ page }) => {
      await page.goto(url())

      expect(await undersizedTargets(page)).toEqual([])
    })
  }
})

test('a field row keeps one action beside the name, and its menu holds the rest', async ({
  page,
}) => {
  await page.goto(settingsUrl)

  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Actions for field Company' }) })
  const name = row.getByText('Company', { exact: true })
  const actions = row.getByRole('button', { name: 'Actions for field Company' })

  await expect(row.getByRole('button', { name: /^Edit field/ })).toBeHidden()
  const [nameBox, actionsBox] = await Promise.all([name.boundingBox(), actions.boundingBox()])
  const middle = nameBox!.y + nameBox!.height / 2
  expect(nameBox!.width).toBeGreaterThan(0)
  expect(actionsBox!.y).toBeLessThan(middle)
  expect(actionsBox!.y + actionsBox!.height).toBeGreaterThan(middle)
  expect(await mainPaneOverflow(page)).toBe(0)

  await actions.click()
  const menu = page.getByRole('menu', { name: 'Field Company' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Edit field', 'Delete field'])

  await menu.getByRole('menuitem', { name: 'Edit field' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit field' })).toBeVisible()
})

test('the settings sections scroll as one row, the current one in view', async ({
  page,
  workspace,
}) => {
  await page.goto(`${workspace.url}/settings/danger`)
  const sections = page.getByRole('navigation', { name: 'Settings sections' })

  await expect(sections.getByRole('link', { name: 'Danger zone' })).toBeInViewport({ ratio: 1 })
  expect(await mainPaneOverflow(page)).toBe(0)
})

test('a member row fits the pane', async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/settings/members`)
  await expect(page.getByRole('listitem').first()).toBeVisible()

  expect(await mainPaneOverflow(page)).toBe(0)
})

test.describe('above the breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the sidebar is simply part of the page', async ({ page }) => {
    await page.goto('/')

    await expect(sidebar(page)).toBeVisible()
    await expect(toggle(page)).toBeHidden()
  })

  test('a record row shows its actions as buttons, and the drawer leaves sorting to the header', async ({
    page,
  }) => {
    await page.goto(recordsUrl)
    const row = page.getByRole('row').filter({ hasText: 'Acme' })

    await expect(row.getByRole('link', { name: 'View record' })).toBeVisible()
    await row.getByRole('button', { name: 'More actions' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Delete record'])
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Sort by/ })).toBeHidden()
  })

  test('a field row shows its actions as buttons', async ({ page }) => {
    await page.goto(settingsUrl)

    await expect(page.getByRole('button', { name: 'Edit field Company' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions for field Company' })).toBeHidden()
  })
})
