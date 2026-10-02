import { expect, prisma, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

let people: ISeededTable
let deals: ISeededTable
let adaId: string
let adaNumber: number

const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog')

test.beforeEach(async ({ seedTable }) => {
  people = await seedTable(
    'People',
    [{ key: 'full_name', type: 'TEXT', name: 'Full name' }],
    [{ full_name: 'Ada' }, { full_name: 'Grace' }],
  )

  const ada = await prisma.record.findFirstOrThrow({
    where: { tableId: people.id, data: { path: ['full_name'], equals: 'Ada' } },
    select: { id: true, number: true },
  })
  adaId = ada.id
  adaNumber = ada.number

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

  /** Moving between two table pages first is the point, so do not simplify this into one `goto`. */
  test('still opens after moving between two tables, which once broke it', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'View record' }).click()
    await expect(dialog(page)).toContainText('Acme')
    await page.getByRole('button', { name: 'Close' }).click()

    // Client-side, since a reload would mask this; the link's name carries a count, hence loose
    await page
      .getByRole('navigation', { name: 'Your tables' })
      .getByRole('link', { name: new RegExp(people.name) })
      .click()
    await expect(page).toHaveURL(people.url)

    await page.getByRole('link', { name: 'View record' }).first().click()

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toContainText(people.name)
    await expect(dialog(page)).toContainText('Full name')
  })

  test('a relation link opens the record it points at, in the other table', async ({ page }) => {
    await page.goto(deals.url)
    await page.getByRole('link', { name: 'Ada' }).click()

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toContainText('People')
    await expect(dialog(page)).toContainText('Ada')
  })

  test('does not refetch the list behind it', async ({ page }) => {
    await page.goto(deals.url)

    let listRequests = 0
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (pathname.endsWith('/records')) listRequests += 1
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
  const url = `${deals.url}?detail=${people.number}.${adaNumber}`
  const html = await (await request.get(url)).text()

  expect(html).toContain('Record details')
  expect(html).toContain('Ada')

  await page.goto(url)
  await expect(dialog(page)).toBeVisible()
})

test('a link written before the switch to numbers still resolves', async ({ page }) => {
  await page.goto(`/tables/${deals.id}?detail=${people.id}.${adaId}`)

  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText('Ada')
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

    // Waited on by table name: the Deals record already shows Ada, so that would pass too early
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
  const url = `${deals.url}?detail=${people.number}.${adaNumber}`
  await prisma.record.delete({ where: { id: adaId } })

  await page.goto(url)

  await expect(dialog(page).getByRole('alert')).toContainText('This record no longer exists.')
  await expect(dialog(page).getByRole('button', { name: /try again/i })).toHaveCount(0)
})

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

  const lines = (scope: import('@playwright/test').Locator) =>
    badges(scope).evaluateAll(
      (entries) =>
        new Set(entries.map((entry) => Math.round(entry.getBoundingClientRect().top))).size,
    )

  await page.goto(tagged.url)

  const row = page.locator('tbody')
  await expect(badges(row).first()).toBeVisible()
  expect(await lines(row)).toBe(1)

  const firstTagIsWhole = await badges(row)
    .first()
    .locator('.base-badge__text')
    .evaluate((text) => text.scrollWidth <= text.clientWidth)

  expect(firstTagIsWhole).toBe(true)

  await page.getByRole('link', { name: 'View record' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await expect(badges(dialog)).toHaveCount(TAGS.length)
  expect(await lines(dialog)).toBeGreaterThan(1)

  const heights = async (scope: import('@playwright/test').Locator) =>
    badges(scope).evaluateAll((entries) =>
      entries.map((entry) => Math.round(entry.getBoundingClientRect().height)),
    )

  expect(new Set([...(await heights(row)), ...(await heights(dialog))]).size).toBe(1)
})

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
