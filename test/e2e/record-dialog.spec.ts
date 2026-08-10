import { expect, prisma, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * The linked-record dialog, which is URL state rather than component state. Every control is a
 * navigation, and that is precisely what makes Back, Forward and a cold link testable at all —
 * and what makes them worth testing, because none of it is visible until it breaks.
 */

let people: ISeededTable
let deals: ISeededTable
let adaId: string

const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog')

test.beforeEach(async ({ seedTable }) => {
  people = await seedTable(
    'People',
    [{ key: 'full_name', type: 'TEXT', name: 'Full name' }],
    [{ full_name: 'Ada' }, { full_name: 'Grace' }],
  )

  const ada = await prisma.record.findFirstOrThrow({
    where: { tableId: people.id, data: { path: ['full_name'], equals: 'Ada' } },
    select: { id: true },
  })
  adaId = ada.id

  deals = await seedTable(
    'Deals',
    [
      { key: 'company', type: 'TEXT', name: 'Company' },
      {
        key: 'owner',
        type: 'RELATION',
        name: 'Owner',
        options: { targetTableId: people.id, labelFieldKey: 'full_name' },
      },
    ],
    [{ company: 'Acme', owner: adaId }],
  )
})

test.describe('opening it', () => {
  test('a row’s View action opens the record it belongs to', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toContainText('Deals')
    await expect(dialog(page)).toContainText('Acme')
    await expect(page).toHaveURL(/detail=/)
  })

  test('a relation link opens the record it points at, in the other table', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'Ada' }).click()

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toContainText('People')
    await expect(dialog(page)).toContainText('Ada')
  })

  /**
   * The list behind it must not refetch — the dialog's param is not part of the list query, and
   * a refetch would be a visible flicker and a wasted round trip on every open.
   */
  test('does not refetch the list behind it', async ({ page }) => {
    await page.goto(deals.url)

    let listRequests = 0
    page.on('request', (request) => {
      if (/\/records\?|\/records$/.test(new URL(request.url()).pathname + request.url())) {
        if (request.url().includes('/records?') || request.url().endsWith('/records')) {
          listRequests += 1
        }
      }
    })

    await page.getByRole('link', { name: 'View record' }).click()
    await expect(dialog(page)).toBeVisible()

    expect(listRequests).toBe(0)
  })
})

test.describe('the browser buttons', () => {
  test('Back closes it and Forward reopens it', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()
    await expect(dialog(page)).toBeVisible()

    await page.goBack()
    await expect(dialog(page)).toBeHidden()
    await expect(page).not.toHaveURL(/detail=/)

    await page.goForward()
    await expect(dialog(page)).toBeVisible()
  })

  test('keeps the list query it was opened over', async ({ page }) => {
    await page.goto(`${deals.url}?sort=company&dir=asc`)
    await page.getByRole('link', { name: 'View record' }).click()

    await expect(page).toHaveURL(/sort=company&dir=asc/)
    await expect(page).toHaveURL(/detail=/)
  })
})

test('a ?detail= URL loaded cold renders the dialog server-side', async ({ page, request }) => {
  const url = `${deals.url}?detail=${people.id}.${adaId}`
  const html = await (await request.get(url)).text()

  expect(html).toContain('Record details')
  expect(html).toContain('Ada')

  await page.goto(url)
  await expect(dialog(page)).toBeVisible()
})

test.describe('drilling in', () => {
  test('a relation inside the dialog drills, and Back returns one level', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()
    await expect(dialog(page)).toContainText('Acme')

    await dialog(page).getByRole('link', { name: 'Ada' }).click()
    await expect(dialog(page)).toContainText('Ada')
    await expect(dialog(page)).toContainText('People')

    await dialog(page).getByRole('link', { name: 'Back' }).click()
    await expect(dialog(page)).toContainText('Acme')
    await expect(dialog(page)).toContainText('Deals')
  })

  test('offers no way back from the outermost record', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()

    await expect(dialog(page).getByRole('link', { name: 'Back' })).toHaveCount(0)
  })
})

test.describe('Open in …', () => {
  test('is offered when the record belongs to another table', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'Ada' }).click()

    await expect(dialog(page).getByRole('link', { name: /Open in People/ })).toBeVisible()
  })

  /** It would point at the page already on screen, dropping its sort and filters to get there. */
  test('is absent for the table already on screen', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()

    await expect(dialog(page).getByRole('link', { name: /Open in/ })).toHaveCount(0)
  })
})

test.describe('closing it', () => {
  test('Escape closes the whole chain and returns focus to the link that opened it', async ({
    page,
  }) => {
    await page.goto(deals.url)

    const opener = page.getByRole('link', { name: 'View record' })
    await opener.click()
    await expect(dialog(page)).toBeVisible()

    // Drill in, so the chain is two deep and Escape has more than one level to close.
    // Waited on by the *table* name, not by "Ada": the Deals record already shows Ada as its
    // owner, so asserting on that would pass before the drill had navigated at all.
    await dialog(page).getByRole('link', { name: 'Ada' }).click()
    await expect(dialog(page)).toContainText('People')

    await page.keyboard.press('Escape')

    await expect(dialog(page)).toBeHidden()
    await expect(page).not.toHaveURL(/detail=/)
    await expect(opener).toBeFocused()
  })

  test('the close button does the same', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()

    await dialog(page).getByRole('button', { name: 'Close' }).click()

    await expect(dialog(page)).toBeHidden()
    await expect(page).not.toHaveURL(/detail=/)
  })
})

test('a target deleted since the page was drawn says so, with no retry', async ({ page }) => {
  const url = `${deals.url}?detail=${people.id}.${adaId}`
  await prisma.record.delete({ where: { id: adaId } })

  await page.goto(url)

  await expect(dialog(page).getByRole('alert')).toContainText('This record no longer exists.')
  // Retrying a 404 cannot help, so it is not offered
  await expect(dialog(page).getByRole('button', { name: /try again/i })).toHaveCount(0)
})

/**
 * A deliberate override, and invisible when it breaks: `MultiValueCell` is `nowrap` because a
 * table row has a fixed height and its cell truncates, and `RecordDetail` flips it to `wrap`
 * because reading a value in full is the whole reason that dialog exists. Lose the override
 * and the dialog silently shows the first few values on one clipped line.
 *
 * Both surfaces in one case, because either alone would pass against a component that wrapped
 * — or truncated — everywhere. Counted as distinct `top` offsets, which is what "a line" is.
 */
test('a multi-value field is one line in the table and wrapped in the dialog', async ({
  page,
  seedTable,
}) => {
  const TAGS = [
    'alpha',
    'bravo',
    'charlie',
    'delta',
    'echo',
    'foxtrot',
    'golf',
    'hotel',
    'india',
    'juliet',
    'kilo',
    'lima',
  ]

  const tagged = await seedTable(
    'Tagged',
    [
      { key: 'name', type: 'TEXT', name: 'Name' },
      {
        key: 'tags',
        type: 'SELECT',
        name: 'Tags',
        options: {
          choices: TAGS.map((value) => ({ value, color: 'gray' as const })),
          multiple: true,
        },
      },
    ],
    [{ name: 'Apollo', tags: TAGS }],
  )

  const badges = (scope: import('@playwright/test').Locator) =>
    scope.locator('.multi-value-cell .base-badge')

  /** How many distinct lines the entries occupy, however many entries there are. */
  const lines = (scope: import('@playwright/test').Locator) =>
    badges(scope).evaluateAll(
      (entries) =>
        new Set(entries.map((entry) => Math.round(entry.getBoundingClientRect().top))).size,
    )

  await page.goto(tagged.url)

  const row = page.locator('tbody')
  await expect(badges(row).first()).toBeVisible()
  expect(await lines(row)).toBe(1)

  await page.getByRole('link', { name: 'View record' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Every value on screen, not the first few — the point of wrapping rather than truncating
  await expect(badges(dialog)).toHaveCount(TAGS.length)
  expect(await lines(dialog)).toBeGreaterThan(1)
})

/**
 * Approximated, and deliberately so: a clipped focus ring is a paint concern. Asserting the
 * focused link's box sits inside its scrolling ancestor catches the structural cause — a cell
 * that clips its own content — without claiming to see the outline itself.
 */
test('the focus ring on a relation link is not clipped by its cell', async ({ page }) => {
  await page.goto(deals.url)

  const link = page.getByRole('link', { name: 'Ada' })
  await link.focus()

  const box = await link.boundingBox()
  const cell = await link.locator('xpath=ancestor::td[1]').boundingBox()

  expect(box).not.toBeNull()
  expect(cell).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(cell!.y - 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(cell!.y + cell!.height + 1)
})
