import { expect, test } from '~~/test/e2e/setup/fixtures'

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

test.beforeEach(async ({ seedTable }) => {
  await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])
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

/** Above the breakpoint it is a column of the grid, always there and with no toggle to press. */
test.describe('above the breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the sidebar is simply part of the page', async ({ page }) => {
    await page.goto('/')

    await expect(sidebar(page)).toBeVisible()
    await expect(toggle(page)).toBeHidden()
  })
})
