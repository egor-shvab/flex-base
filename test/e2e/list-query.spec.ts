import { expect, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * The list query, which lives entirely in the URL. Everything here is about what the *running*
 * app does with a link — the codec and the SQL underneath are pinned four layers down.
 */

let table: ISeededTable

const companies = (page: import('@playwright/test').Page) =>
  page.locator('tbody tr td:nth-child(2)').allInnerTexts()

/**
 * Polled, never read once: a URL change resolves the moment the address bar moves, but the
 * rows behind it are refetched asynchronously — reading straight after would assert on the
 * previous query's results often enough to be flaky and never enough to be noticed.
 */
const expectCompanies = (page: import('@playwright/test').Page, expected: string[]) =>
  expect.poll(() => companies(page)).toEqual(expected)

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable(
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
    [
      { company: 'Acme', contract_value: 100, active: true, stage: 'Won' },
      { company: 'Beta', contract_value: 900, active: false, stage: 'Lost' },
      { company: 'Gamma', contract_value: 50, active: true, stage: 'Won' },
    ],
  )
})

/**
 * The headline SSR contract: a shared link must arrive already filtered. Asserted against the
 * server's own HTML rather than the hydrated page — that is the only way to tell "rendered
 * filtered" from "rendered everything, then filtered in the browser".
 */
test.describe('a link loaded cold', () => {
  test('renders filtered server-side, before any JavaScript runs', async ({ page, request }) => {
    const html = await (await request.get(`${table.url}?stage=Won`)).text()
    const body = html.split('<tbody')[1] ?? ''

    expect(body).toContain('Acme')
    expect(body).toContain('Gamma')
    expect(body).not.toContain('Beta')

    await page.goto(`${table.url}?stage=Won`)
    await expectCompanies(page, ['Gamma', 'Acme'])
  })

  test('renders sorted server-side too', async ({ request }) => {
    const html = await (await request.get(`${table.url}?sort=company&dir=asc`)).text()
    const body = html.split('<tbody')[1] ?? ''

    expect(body.indexOf('Acme')).toBeLessThan(body.indexOf('Beta'))
    expect(body.indexOf('Beta')).toBeLessThan(body.indexOf('Gamma'))
  })

  test('shows the filter already reflected in the summary and the drawer', async ({ page }) => {
    await page.goto(`${table.url}?stage=Won`)

    await expect(page.locator('.filter-summary__chip')).toContainText('Stage is Won')

    // The non-searchable trigger is a button labelled by its own label *and* its value, so its
    // accessible name reads "Stage Won" — which is exactly the assertion worth making
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(
      page.locator('.filter-panel').getByRole('button', { name: /^Stage/ }),
    ).toHaveAccessibleName(/Stage\s+Won/)
  })

  test('logs no console errors while doing it', async ({ page, consoleErrors }) => {
    await page.goto(`${table.url}?stage=Won&sort=company&dir=asc`)
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    expect(consoleErrors).toEqual([])
  })
})

/**
 * The app's only in-page recovery path. `fetchRecords` sets `failed` **and rethrows**, because
 * a refetch runs from a watcher where swallowing would leave the table showing rows that no
 * longer match the URL — so the banner is what tells the user the view on screen is stale.
 *
 * Note the sequencing: the first load is SSR, which `page.route` cannot intercept, and `failed`
 * is set by a *client-side* refetch. So the page is loaded first and the route cut afterwards.
 */
test.describe('when the list cannot be loaded', () => {
  test('says so rather than leaving stale rows looking current', async ({ page }) => {
    await page.goto(table.url)
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    await page.route('**/api/tables/*/records?*', (route) => route.abort())
    await page.getByRole('button', { name: /^Company/ }).click()

    const banner = page.getByRole('alert')
    await expect(banner).toContainText('couldn’t be loaded')
    await expect(banner.getByRole('link', { name: /start again with all records/i })).toBeVisible()
  })

  test('the recovery link goes back to the unfiltered table', async ({ page }) => {
    await page.goto(`${table.url}?stage=Won`)
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    await page.route('**/api/tables/*/records?*', (route) => route.abort())
    await page.getByRole('button', { name: /^Company/ }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    await page.unroute('**/api/tables/*/records?*')
    await page.getByRole('link', { name: /start again with all records/i }).click()

    await expect(page).toHaveURL(table.url)
    await expectCompanies(page, ['Gamma', 'Beta', 'Acme'])
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('sorting', () => {
  const sortBy = (page: import('@playwright/test').Page, column: string) =>
    page.getByRole('button', { name: new RegExp(`^${column}`) }).click()

  test('orders ascending, then flips, and each step is a history entry', async ({ page }) => {
    await page.goto(table.url)

    await sortBy(page, 'Company')
    await expect(page).toHaveURL(/sort=company&dir=asc/)
    await expectCompanies(page, ['Acme', 'Beta', 'Gamma'])

    await sortBy(page, 'Company')
    // `desc` is the default direction, so it is absent from the URL rather than spelled out
    await expect(page).toHaveURL(/sort=company(?!&dir)/)
    await expectCompanies(page, ['Gamma', 'Beta', 'Acme'])

    await page.goBack()
    await expect(page).toHaveURL(/sort=company&dir=asc/)
    await expectCompanies(page, ['Acme', 'Beta', 'Gamma'])
  })

  test('sorts a number numerically, so 50 comes before 100', async ({ page }) => {
    await page.goto(`${table.url}?sort=contract_value&dir=asc`)

    await expectCompanies(page, ['Gamma', 'Acme', 'Beta'])
  })

  test('sorts the record number as an integer, so #9 precedes #10', async ({ page, seedTable }) => {
    const many = await seedTable(
      'Many',
      [{ key: 'company', type: 'TEXT', name: 'Company' }],
      Array.from({ length: 11 }, (_, index) => ({ company: `Co ${index + 1}` })),
    )

    await page.goto(`${many.url}?sort=recordNumber&dir=asc`)

    const numbers = await page.locator('tbody tr td:nth-child(1)').allInnerTexts()
    expect(numbers.slice(0, 11)).toEqual(Array.from({ length: 11 }, (_, index) => `#${index + 1}`))
  })
})

test.describe('searching', () => {
  const search = (page: import('@playwright/test').Page) => page.getByLabel('Search this table')

  test('narrows the table and replaces rather than stacking history', async ({ page }) => {
    await page.goto(table.url)
    const before = await page.evaluate(() => history.length)

    await search(page).fill('acm')
    await expect(page).toHaveURL(/search=acm/)
    await expectCompanies(page, ['Acme'])

    expect(await page.evaluate(() => history.length)).toBe(before)
  })

  test('drops a term below the floor rather than sending it', async ({ page }) => {
    await page.goto(`${table.url}?search=acm`)

    await search(page).fill('a')

    await expect(page).not.toHaveURL(/search=/)
    await expect.poll(() => companies(page)).toHaveLength(3)
  })

  test('matches a NUMBER column through its text', async ({ page }) => {
    await page.goto(table.url)
    await search(page).fill('900')

    await expect(page).toHaveURL(/search=900/)
    await expectCompanies(page, ['Beta'])
  })

  test('does not match a BOOLEAN column', async ({ page }) => {
    await page.goto(`${table.url}?search=true`)

    await expect(page.locator('.records-page__empty')).toBeVisible()
  })

  test('says what it could not find, naming the term', async ({ page }) => {
    await page.goto(`${table.url}?search=zzzznothing`)

    await expect(page.locator('.records-page__empty')).toContainText('Nothing matches')
    await expect(page.locator('.records-page__empty')).toContainText('zzzznothing')
  })
})

test.describe('the filter drawer', () => {
  test('a range filter writes both bounds and resyncs after Clear all', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Filters' }).click()

    // One bound at a time, each awaited into the URL before the next. Both controls debounce
    // and then re-read their value back from the URL, so filling them instantly lets the
    // second write build on state the first has not landed yet and lose a bound.
    await page.getByLabel('From').first().fill('80')
    await expect(page).toHaveURL(/contract_value_from=80/)

    await page.getByLabel('To').first().fill('500')
    await expect(page).toHaveURL(/contract_value_to=500/)

    await expectCompanies(page, ['Acme'])

    await page.getByRole('button', { name: /clear all/i }).click()

    // The control has to follow the URL back to empty, or it shows a filter that is not applied
    await expect(page.getByLabel('From').first()).toHaveValue('')
    await expect(page.getByLabel('To').first()).toHaveValue('')
    await expect.poll(() => companies(page)).toHaveLength(3)
  })

  test('a range filter resyncs on the back button', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('From').first().fill('80')
    await expect(page).toHaveURL(/contract_value_from=80/)

    await page.goto(table.url)
    await page.getByRole('button', { name: 'Filters' }).click()

    await expect(page.getByLabel('From').first()).toHaveValue('')
  })

  test('a filter edit replaces history, so Back leaves the table rather than undoing keystrokes', async ({
    page,
  }) => {
    await page.goto(table.url)
    const before = await page.evaluate(() => history.length)

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('Company').fill('acm')
    await expect(page).toHaveURL(/company=acm/)

    expect(await page.evaluate(() => history.length)).toBe(before)
  })
})

test.describe('paging', () => {
  test('steps through pages and each step is a history entry', async ({ page, seedTable }) => {
    const many = await seedTable(
      'Many',
      [{ key: 'company', type: 'TEXT', name: 'Company' }],
      Array.from({ length: 60 }, (_, index) => ({ company: `Co ${index + 1}` })),
    )

    await page.goto(many.url)
    await expect(page.locator('.pagination__count')).toHaveText('1–50 of 60')

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('.pagination__count')).toHaveText('51–60 of 60')

    await page.goBack()
    await expect(page.locator('.pagination__count')).toHaveText('1–50 of 60')
  })
})
