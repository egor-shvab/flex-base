import { expect, test } from '~~/test/e2e/setup/fixtures'
import { axeViolations, undersizedTargets } from '~~/test/e2e/setup/a11y'

/**
 * The shell below `$breakpoint-shell` (900px), where the sidebar stops being a column and
 * becomes an off-canvas panel over the content. No other spec renders this layout at all.
 *
 * The rule it protects is `CLAUDE.md` §8: an off-canvas surface must never leave focusable
 * content off-screen. The fix is `visibility: hidden` **as well as** the transform — a panel
 * translated out of view alone is still in the tab order, so Tab from the header walks into
 * a menu nobody can see. Playwright's visibility honours `visibility: hidden`, which is
 * exactly why these assertions can tell the two apart.
 *
 * Scoped to this file: `test.use` at the top level overrides the viewport for its own tests
 * and nothing else.
 */
test.use({ viewport: { width: 375, height: 812 } })

const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Show tables' })

const sidebar = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Your tables' })

let recordsUrl = ''

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
    [{ company: 'Acme', contract_value: 100, active: true, stage: 'Won' }],
  )
  recordsUrl = table.url
})

test('the sidebar is off-screen and unreachable until it is asked for', async ({ page }) => {
  await page.goto('/')

  await expect(sidebar(page)).toBeHidden()
  // Not merely translated: nothing inside may be focusable, or Tab walks into it
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

/**
 * Geometry, because no assertion above can see it: `toBeVisible()` reads the same whether the
 * panel starts at the viewport top or 56px below it, so an anchor that drifts back to the header
 * height would leave this file green and the drawer visibly misaligned. Measuring is the
 * structural-reach exception to the roles-and-names rule (`CLAUDE.md` §10). The open transition is
 * horizontal, so `y` is settled the moment the panel is visible.
 */
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

/** It covers the content at this width, so leaving it open over the page just navigated to
 * would hide the very thing the user asked for. */
test('navigating through it dismisses it', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()

  await sidebar(page).getByRole('link', { name: /Deals/ }).click()

  await expect(page).toHaveURL(/\/tables\/[^/]+\/records/)
  await expect(sidebar(page)).toBeHidden()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
})

test('the scrim behind it dismisses it without navigating', async ({ page }) => {
  await page.goto('/')
  await toggle(page).click()
  await expect(sidebar(page)).toBeVisible()

  await page.locator('.app-layout__scrim').click()

  await expect(sidebar(page)).toBeHidden()
  await expect(page).toHaveURL('/')
})

/**
 * A table is the one thing that cannot simply reflow to 375px. The rule is that it scrolls
 * inside its own container — the page body must never scroll sideways, or every screen in the
 * app inherits a horizontal scrollbar from one wide column.
 */
test('the records table scrolls inside itself, not the page', async ({ page }) => {
  await page.goto(recordsUrl)
  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

  const pageOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(pageOverflows).toBe(false)
})

/**
 * A dialog at this width has nowhere to overflow to, so it must fit rather than be dragged.
 *
 * Both axes, and the vertical half is the one that was missing: the scrim centres the dialog, so
 * an uncapped one taller than the screen overflows *both* edges at once — and the shell is
 * `height: 100dvh; overflow: hidden`, so the document cannot be scrolled to reach either.
 */
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
 * The same dialog with more content than the screen can hold, which is where the cap earns its
 * keep: the dialog stops growing and its *body* scrolls, so the header stays on screen and the
 * submit button is reached by scrolling rather than being clipped away.
 *
 * `toBeInViewport`, never `toBeVisible`: Playwright counts an element scrolled out of an overflow
 * container as visible, so the weaker assertion passes against the very bug this pins.
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

  // The header is the half that used to be pushed off the top, and it never scrolls away
  const title = dialog.getByRole('heading', { name: 'New record' })
  await expect(title).toBeInViewport()

  // The body genuinely overflows, or the case is proving nothing. Reaching for the class is the
  // structural-reach exception to the roles-and-names rule (`CLAUDE.md` §10) — a scroll container
  // is not a thing a user targets, so no role names it.
  const body = dialog.locator('.base-modal__body')
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(
    true,
  )

  const submit = dialog.getByRole('button', { name: 'Create record' })
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
  await expect(title).toBeInViewport()
})

/**
 * Both gates again at this width, because the shell is a different layout — the header gains a
 * control the desktop never renders, and a target that clears the floor in a roomy row can be
 * squeezed under it when the row is 375px wide.
 */
test.describe('the gates at this width', () => {
  for (const [name, path] of [
    ['the dashboard', '/'],
    ['the records list', ''],
  ] as const) {
    test(`${name} has no serious or critical violations`, async ({ page }) => {
      await page.goto(path === '' ? recordsUrl : path)

      expect(await axeViolations(page)).toEqual([])
    })

    test(`${name} has no target below 24×24`, async ({ page }) => {
      await page.goto(path === '' ? recordsUrl : path)

      expect(await undersizedTargets(page)).toEqual([])
    })
  }
})

/** Above the breakpoint it is a column of the grid, always there and with no toggle to press. */
test.describe('above the breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the sidebar is simply part of the page', async ({ page }) => {
    await page.goto('/')

    await expect(sidebar(page)).toBeVisible()
    await expect(toggle(page)).toBeHidden()
  })
})
