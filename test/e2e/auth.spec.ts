import { expect, test } from '~~/test/e2e/setup/fixtures'
import { E2E_USER } from '~~/test/e2e/setup/global-setup'

/**
 * The journey every other file depends on, plus the guard that decides who sees what. Run
 * signed out — `storageState: undefined` drops the cookie the rest of the suite runs with.
 */
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a protected page sends you to sign in, remembering where you were going', async ({
    page,
  }) => {
    await page.goto('/tables/whatever/records?stage=Won')

    await expect(page).toHaveURL(/\/auth\/login\?redirect=/)
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  })

  test('the root carries no redirect, since that is where signing in lands anyway', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test('signing in returns you to the page you asked for', async ({ page, seedTable }) => {
    const table = await seedTable(
      'Deals',
      [{ key: 'company', type: 'TEXT', name: 'Company' }],
      [{ company: 'Acme' }],
    )

    await page.goto(table.url)
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/)

    await page.getByLabel('Email').fill(E2E_USER.email)
    await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(table.url)
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  })

  test('a wrong password says so without saying which half was wrong', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByLabel('Email').fill(E2E_USER.email)
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByRole('alert')).toHaveText(/invalid email or password/i)
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('registering signs you straight in', async ({ page }) => {
    const email = `new-${Date.now()}@example.com`

    await page.goto('/auth/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery')
    await page.getByLabel('Confirm password').fill('correct-horse-battery')
    await page.getByRole('button', { name: 'Register' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
  })
})

test.describe('signed in', () => {
  test('lands on the dashboard', async ({ page, userId }) => {
    expect(userId).toBeTruthy()

    await page.goto('/')

    await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
  })

  test('is bounced off the sign-in page', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page).toHaveURL('/')
  })

  test('logging out ends the session and protects the pages again', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /log out/i }).click()

    await expect(page).toHaveURL(/\/auth\/login/)

    await page.goto('/')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
