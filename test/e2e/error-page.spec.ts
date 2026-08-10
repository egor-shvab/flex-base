import { expect, test } from '~~/test/e2e/setup/fixtures'

/**
 * The whole-app error boundary — a page nothing else in any suite renders. Both table pages
 * turn a failed load into `createError(toPageError(…))`, and `app/utils/api-error.spec.ts`
 * pins that mapping; what happens to the result is only observable here.
 *
 * It is deliberately store-free, because data fetching is exactly what failed by the time it
 * renders. That is the property these cases protect: the page must stand on its own.
 */
test('a table that does not exist renders the 404 boundary, not a broken page', async ({
  page,
}) => {
  await page.goto('/tables/does-not-exist/records')

  await expect(page.getByRole('heading', { name: /we couldn’t find that/i })).toBeVisible()
  await expect(page.locator('.error-page__code')).toHaveText('404')
  // The one status where we know what was missing, so the copy names it
  await expect(page.locator('.error-page__message')).toContainText('table')
})

test('the same for a table settings page', async ({ page }) => {
  await page.goto('/tables/does-not-exist')

  await expect(page.getByRole('heading', { name: /we couldn’t find that/i })).toBeVisible()
})

/**
 * A malformed link is not a missing table, and saying "we couldn't find that table" about a
 * table that loaded perfectly well is the bug this branch exists for.
 */
test('a link the server could not read says so instead of blaming the table', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

  await page.goto(`${table.url}?sort=nonexistent-column`)

  await expect(page.locator('.error-page__code')).toHaveText('400')
  await expect(page.locator('.error-page__message')).toContainText('could not be read')
  // The 404's copy, which would be a lie here: the table loaded, the query did not parse
  await expect(page.locator('.error-page__message')).not.toContainText('find that table')
  await expect(page.getByRole('heading', { name: /didn’t work/i })).toBeVisible()
})

test('the recovery action returns to the dashboard', async ({ page }) => {
  await page.goto('/tables/does-not-exist/records')
  await expect(page.locator('.error-page__code')).toHaveText('404')

  await page.getByRole('button', { name: 'Back to your tables' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
})
