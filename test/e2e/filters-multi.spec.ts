import { expect, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * A multi-value SELECT filter, which is the one filter shape that repeats its param. Its whole
 * contract lives in the URL, so every case here is really about a link being shareable.
 */

let table: ISeededTable

const companies = (page: import('@playwright/test').Page) =>
  page.locator('tbody tr td:nth-child(2)').allInnerTexts()

const expectCompanies = (page: import('@playwright/test').Page, expected: string[]) =>
  expect.poll(() => companies(page)).toEqual(expected)

const stageFilter = (page: import('@playwright/test').Page) =>
  page.locator('.filter-panel').getByRole('button', { name: /^Stage/ })

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable(
    'Deals',
    [
      { key: 'company', type: 'TEXT', name: 'Company' },
      {
        key: 'stage',
        type: 'SELECT',
        name: 'Stage',
        options: {
          choices: [
            { value: 'Won', color: 'green' },
            { value: 'Lost', color: 'red' },
            { value: 'Open', color: 'blue' },
          ],
        },
      },
    ],
    [
      { company: 'Acme', stage: 'Won' },
      { company: 'Beta', stage: 'Lost' },
      { company: 'Gamma', stage: 'Open' },
    ],
  )
})

test('two choices repeat the param, sorted, and the table shows the union', async ({ page }) => {
  await page.goto(table.url)
  await page.getByRole('button', { name: 'Filters' }).click()

  await stageFilter(page).click()
  await page.getByRole('option', { name: 'Won', exact: true }).click()
  await page.getByRole('option', { name: 'Lost', exact: true }).click()

  // Sorted, so the same selection always writes the same URL however it was clicked
  await expect(page).toHaveURL(/stage=Lost&stage=Won/)
  await expectCompanies(page, ['Beta', 'Acme'])
})

/**
 * One case, not two. That the summary *reaches* the chip is a wiring question and belongs
 * here; which words it chooses for one value versus several is a matrix, and
 * `app/field-types/filter-summaries.spec.ts` owns every cell of it.
 */
test('the summary chip reads as an any-of', async ({ page }) => {
  await page.goto(`${table.url}?stage=Won&stage=Lost`)

  await expect(page.locator('.filter-summary__chip')).toContainText('is any of')
  await expect(page.locator('.filter-summary__chip')).toContainText('Lost')
  await expect(page.locator('.filter-summary__chip')).toContainText('Won')
})

test('that URL loaded cold renders filtered with both options ticked', async ({
  page,
  request,
}) => {
  const html = await (await request.get(`${table.url}?stage=Won&stage=Lost`)).text()
  const body = html.split('<tbody')[1] ?? ''

  expect(body).toContain('Acme')
  expect(body).toContain('Beta')
  expect(body).not.toContain('Gamma')

  await page.goto(`${table.url}?stage=Won&stage=Lost`)
  await page.getByRole('button', { name: 'Filters' }).click()
  await stageFilter(page).click()

  await expect(page.getByRole('option', { name: 'Won', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('option', { name: 'Lost', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('option', { name: 'Open', exact: true })).toHaveAttribute(
    'aria-selected',
    'false',
  )
})

test('clearing removes the param rather than leaving it empty', async ({ page }) => {
  await page.goto(`${table.url}?stage=Won&stage=Lost`)

  // The summary's own control — "Clear all" lives in the drawer footer
  await page.getByRole('button', { name: 'Show all records' }).click()

  await expect(page).not.toHaveURL(/stage=/)
  await expect.poll(() => companies(page)).toHaveLength(3)
})

test('removing one chip leaves the rest of the query alone', async ({ page }) => {
  await page.goto(`${table.url}?stage=Won&stage=Lost&sort=company&dir=asc`)

  await page.getByRole('button', { name: /Remove the Stage filter/i }).click()

  await expect(page).not.toHaveURL(/stage=/)
  await expect(page).toHaveURL(/sort=company&dir=asc/)
})

/**
 * The two layers answer a crafted value differently, and both are deliberate: the endpoint
 * rejects it outright, while the page's codec *drops* what it cannot decode — so a mangled
 * link degrades to the unfiltered table rather than to an error screen.
 */
test.describe('a value the field does not offer', () => {
  test('is a 400 from the endpoint', async ({ request }) => {
    const response = await request.get(`/api/tables/${table.id}/records?stage=Nonexistent`)

    expect(response.status()).toBe(400)
  })

  test('is dropped by the page, which renders unfiltered rather than erroring', async ({
    page,
  }) => {
    await page.goto(`${table.url}?stage=Nonexistent`)

    await expect.poll(() => companies(page)).toHaveLength(3)
    await expect(page.locator('.filter-summary__chip')).toHaveCount(0)
  })
})
