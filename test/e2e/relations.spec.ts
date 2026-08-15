import {
  confirmDeletion,
  createField,
  createRecords,
  expect,
  prisma,
  test,
} from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * A relation stores an id, and every one of these is about that id never reaching the screen.
 * The label resolution, the ordering and the degradation are all things the browser has to get
 * right after the server has answered.
 */

let people: ISeededTable
let deals: ISeededTable

const owners = (page: import('@playwright/test').Page) =>
  page.locator('tbody tr td:nth-child(3)').allInnerTexts()

/**
 * A person's record id, looked up by the name on screen — a relation stores the id, so almost
 * every fixture here needs to turn a readable name into one. Declared once at file scope
 * because three seeds want it, each of which was re-reading the same three rows.
 */
async function idOf(name: string): Promise<string> {
  const targets = await prisma.record.findMany({
    where: { tableId: people.id },
    select: { id: true, data: true },
    orderBy: { number: 'asc' },
  })

  return targets.find((row) => (row.data as { full_name?: string }).full_name === name)?.id ?? ''
}

test.beforeEach(async ({ seedTable }) => {
  people = await seedTable(
    'People',
    [{ key: 'full_name', type: 'TEXT', name: 'Full name' }],
    [{ full_name: 'Ada' }, { full_name: 'Grace' }, { full_name: 'Zoe' }],
  )

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
    [
      { company: 'Acme', owner: await idOf('Zoe') },
      { company: 'Beta', owner: await idOf('Ada') },
      { company: 'Gamma', owner: await idOf('Grace') },
    ],
  )
})

test('a link renders as its label, never as the stored id', async ({ page }) => {
  const target = await prisma.record.findFirstOrThrow({
    where: { tableId: people.id, data: { path: ['full_name'], equals: 'Ada' } },
    select: { id: true },
  })

  await page.goto(deals.url)

  await expect(page.getByRole('link', { name: 'Ada' })).toBeVisible()
  await expect(page.locator('tbody')).not.toContainText(target.id)
})

test('the column sorts alphabetically by label, not by id', async ({ page }) => {
  await page.goto(`${deals.url}?sort=owner&dir=asc`)

  await expect.poll(() => owners(page)).toEqual(['Ada', 'Grace', 'Zoe'])
})

test('a deleted target degrades to an unclickable Unknown record', async ({ page }) => {
  const target = await prisma.record.findFirstOrThrow({
    where: { tableId: people.id, data: { path: ['full_name'], equals: 'Ada' } },
  })
  await prisma.record.delete({ where: { id: target.id } })

  await page.goto(deals.url)

  await expect(page.getByText('Unknown record')).toBeVisible()
  // Degraded, not merely relabelled — there is nothing to open
  await expect(page.getByRole('link', { name: 'Unknown record' })).toHaveCount(0)
  // The siblings still link
  await expect(page.getByRole('link', { name: 'Grace' })).toBeVisible()
})

/**
 * The server refuses, and the table survives — which is the property that matters, because a
 * cascade here would break every link into it silently.
 *
 * The dialog now says **why**. It used to stay open in silence: the 409 named the field to
 * remove first, but `useDeleteConfirm` re-threw into a template binding with nobody to catch
 * it, so the message reached the console instead of the screen.
 */
test('deleting a targeted table is refused, and says which field to remove', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('listitem').filter({ hasText: 'People' })
  await card.getByRole('button', { name: 'Delete' }).click()
  await confirmDeletion(page)

  // The dialog stays open, because the delete never succeeded — and now explains itself,
  // naming the field to remove first and the table it lives on
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('alert')).toContainText('Owner')
  await expect(dialog.getByRole('alert')).toContainText('Deals')

  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'People' })).toBeVisible()
})

/** Cancelling after a refusal must not carry the message into the next dialog. */
test('the refusal is forgotten once the dialog is dismissed', async ({ page }) => {
  await page.goto('/')

  const people = page.getByRole('listitem').filter({ hasText: 'People' })
  await people.getByRole('button', { name: 'Delete' }).click()
  await confirmDeletion(page)
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Deals' })
    .getByRole('button', { name: 'Delete' })
    .click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0)
})

test('deleting a table nothing points at succeeds', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('listitem').filter({ hasText: 'Deals' })
  await card.getByRole('button', { name: 'Delete' }).click()
  await confirmDeletion(page)

  await expect(page.getByRole('listitem').filter({ hasText: 'Deals' })).toHaveCount(0)
})

test.describe('a multi-value relation', () => {
  test('links each value independently, degrading only the deleted one', async ({
    page,
    seedTable,
  }) => {
    const targets = await prisma.record.findMany({
      where: { tableId: people.id },
      select: { id: true },
      orderBy: { number: 'asc' },
    })
    const ids = targets.map((row) => row.id)

    const multi = await seedTable('Projects', [{ key: 'name', type: 'TEXT', name: 'Name' }])
    const field = await createField(multi.id, {
      key: 'crew',
      name: 'Crew',
      type: 'RELATION',
      order: 1,
      options: { targetTableId: people.id, labelFieldKey: 'full_name', multiple: true },
    })
    expect(field.options?.multiple).toBe(true)

    await createRecords(multi.id, [{ name: 'Apollo', crew: ids }])
    await prisma.record.delete({ where: { id: ids[0] ?? '' } })

    await page.goto(multi.url)

    await expect(page.getByText('Unknown record')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Grace' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zoe' })).toBeVisible()
  })

  test('sorts by its first value, blanks last', async ({ page, seedTable }) => {
    const multi = await seedTable('Projects', [{ key: 'name', type: 'TEXT', name: 'Name' }])
    await createField(multi.id, {
      key: 'crew',
      name: 'Crew',
      type: 'RELATION',
      order: 1,
      options: { targetTableId: people.id, labelFieldKey: 'full_name', multiple: true },
    })
    await createRecords(multi.id, [
      { name: 'Zeta', crew: [await idOf('Zoe')] },
      { name: 'Alpha', crew: [await idOf('Ada')] },
      { name: 'Blank', crew: [] },
    ])

    await page.goto(`${multi.url}?sort=crew&dir=asc`)

    const names = await page.locator('tbody tr td:nth-child(2)').allInnerTexts()
    expect(names).toEqual(['Alpha', 'Zeta', 'Blank'])
  })
})

test.describe('widening a field', () => {
  test('leaves every existing value rendering unchanged', async ({ page, seedTable }) => {
    const targets = await prisma.record.findMany({
      where: { tableId: people.id },
      select: { id: true },
      orderBy: { number: 'asc' },
    })

    const table = await seedTable('Crews', [{ key: 'name', type: 'TEXT', name: 'Name' }])
    const field = await createField(table.id, {
      key: 'lead',
      name: 'Lead',
      type: 'RELATION',
      order: 1,
      options: { targetTableId: people.id, labelFieldKey: 'full_name' },
    })
    await createRecords(table.id, [{ name: 'Apollo', lead: targets[0]?.id ?? '' }])

    await page.goto(table.url)
    await expect(page.getByRole('link', { name: 'Ada' })).toBeVisible()

    // Widen through the UI, which is what runs the migration over the rows that exist
    await page.goto(`/tables/${table.id}/settings`)
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Lead' })
      .getByRole('button', { name: 'Edit' })
      .click()
    await page.getByLabel('Allow multiple values').check()
    await page.getByRole('button', { name: 'Save' }).click()

    await page.goto(table.url)
    await expect(page.getByRole('link', { name: 'Ada' })).toBeVisible()
    expect(field.options?.multiple).toBeFalsy()
  })
})
