import { expect, test } from '~~/test/e2e/setup/fixtures'

/**
 * The metadata layer built the way a user builds it — the one file that clicks through the
 * setup flow instead of seeding it, so the generated forms are exercised rather than assumed.
 */

async function addField(page: import('@playwright/test').Page, name: string, type: string) {
  await page.getByRole('button', { name: 'Add field' }).first().click()
  await page.getByLabel('Field name').fill(name)
  await page.getByLabel('Type').click()
  await page.getByRole('option', { name: type, exact: true }).click()
}

test('a table, its fields and its first record, start to finish', async ({ page, userId }) => {
  expect(userId).toBeTruthy()

  await page.goto('/')
  // Two on an empty workspace — the header's and the empty state's
  await page.getByRole('button', { name: 'Add table' }).first().click()
  await page.getByLabel('Table name').fill('Deals')
  await page.getByRole('button', { name: 'Create table' }).click()

  // Scoped to the page body: the sidebar lists every table too, so an unscoped name is ambiguous
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: /Deals/ })).toBeVisible()

  await main.getByRole('link', { name: /Deals/ }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Deals' })).toBeVisible()

  await addField(page, 'Company', 'Text')
  await page.getByRole('button', { name: 'Create field' }).click()

  // The key is derived from the name, and shown so the URL contract is visible
  await expect(page.getByText('company', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Records' }).click()
  // Two again while the table is empty — the header's and the empty state's
  await page.getByRole('button', { name: 'Add record' }).first().click()
  await page.getByLabel('Company').fill('Acme')
  await page.getByRole('button', { name: 'Create record' }).click()

  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(page.getByText('#1')).toBeVisible()
})

/**
 * Cardinality is per-field rather than a second field type, and the form says so: only the two
 * types with a list form offer it, and it locks once saved on — because widening migrates the
 * rows that exist and narrowing would have to discard values.
 */
test.describe('allow multiple values', () => {
  test('is offered for SELECT and RELATION only', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])
    const multiple = page.getByLabel('Allow multiple values')

    await page.goto(`/tables/${table.id}`)
    await page.getByRole('button', { name: 'Add field' }).first().click()

    for (const type of ['Text', 'Number', 'Checkbox', 'Date']) {
      await page.getByLabel('Type').click()
      await page.getByRole('option', { name: type, exact: true }).click()
      await expect(multiple, type).toBeHidden()
    }

    await page.getByLabel('Type').click()
    await page.getByRole('option', { name: 'Select', exact: true }).click()
    await expect(multiple).toBeVisible()
  })

  test('locks once a field is saved with it on', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [
      {
        key: 'stage',
        type: 'SELECT',
        name: 'Stage',
        options: { choices: [{ value: 'Won', color: 'green' }], multiple: true },
      },
    ])

    await page.goto(`/tables/${table.id}`)
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByLabel('Allow multiple values')).toBeDisabled()
    await expect(page.getByText(/cannot be changed back to a single value/i)).toBeVisible()
  })

  test('stays editable while a field is still single-value', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [
      {
        key: 'stage',
        type: 'SELECT',
        name: 'Stage',
        options: { choices: [{ value: 'Won', color: 'green' }], multiple: false },
      },
    ])

    await page.goto(`/tables/${table.id}`)
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByLabel('Allow multiple values')).toBeEnabled()
  })
})

test('the type of an existing field cannot be changed', async ({ page, seedTable }) => {
  const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

  await page.goto(`/tables/${table.id}`)
  await page.getByRole('button', { name: 'Edit' }).first().click()

  await expect(page.getByLabel('Type')).toBeDisabled()
})
