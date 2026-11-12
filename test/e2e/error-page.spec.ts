import { WORKSPACE_HOME, expect, test } from '~~/test/e2e/setup/fixtures'

test('a table that does not exist renders the 404 boundary, not a broken page', async ({
  page,
  workspace,
}) => {
  await page.goto(`${workspace.url}/tables/does-not-exist`)

  await expect(page.getByRole('heading', { name: /we couldn’t find that/i })).toBeVisible()
  await expect(page.locator('.error-page__code')).toHaveText('404')
  await expect(page.locator('.error-page__message')).toContainText('table')
})

test('the same for a table settings page', async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/tables/does-not-exist/settings`)

  await expect(page.getByRole('heading', { name: /we couldn’t find that/i })).toBeVisible()
})

test('a link the server could not read says so instead of blaming the table', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

  await page.goto(`${table.url}?sort=nonexistent-column`)

  await expect(page.locator('.error-page__code')).toHaveText('400')
  await expect(page.locator('.error-page__message')).toContainText('could not be read')
  await expect(page.locator('.error-page__message')).not.toContainText('find that table')
  await expect(page.getByRole('heading', { name: /didn’t work/i })).toBeVisible()
})

test('a workspace the user is not in reads as missing, never as forbidden', async ({ page }) => {
  await page.goto('/w/zzzzzzzzzz')

  await expect(page.locator('.error-page__code')).toHaveText('404')
  await expect(page.locator('.error-page__message')).toContainText('find that workspace')
})

test('the recovery action returns to the dashboard', async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/tables/does-not-exist`)
  await expect(page.locator('.error-page__code')).toHaveText('404')

  await page.getByRole('button', { name: 'Back to home' }).click()

  await expect(page).toHaveURL(WORKSPACE_HOME)
  await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
})

test('going back from a cold load falls back to the dashboard', async ({ page, workspace }) => {
  await page.goto(`${workspace.url}/tables/does-not-exist`)
  await expect(page.locator('.error-page__code')).toHaveText('404')

  await page.getByRole('button', { name: 'Go back' }).click()

  await expect(page).toHaveURL(WORKSPACE_HOME)
  await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
})
