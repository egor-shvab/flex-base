import { confirmDeletion, expect, test } from '~~/test/e2e/setup/fixtures'

async function addField(page: import('@playwright/test').Page, name: string, type: string) {
  await page.getByRole('button', { name: 'Add field' }).first().click()
  await page.getByLabel('Field name').fill(name)
  await page.getByLabel('Type').click()
  await page.getByRole('option', { name: type, exact: true }).click()
}

test('a table, its fields and its first record, start to finish', async ({ page, userId }) => {
  expect(userId).toBeTruthy()

  await page.goto('/')
  await page.getByRole('button', { name: 'Add table' }).first().click()
  await page.getByLabel('Table name').fill('Deals')
  await page.getByRole('button', { name: 'Create table' }).click()

  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: /Deals/ })).toBeVisible()

  await main.getByRole('link', { name: /Deals/ }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Deals' })).toBeVisible()

  await addField(page, 'Company', 'Text')
  await page.getByRole('button', { name: 'Create field' }).click()

  await expect(page.getByText('company', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Records' }).click()
  await page.getByRole('button', { name: 'Add record' }).first().click()
  await page.getByLabel('Company').fill('Acme')
  await page.getByRole('button', { name: 'Create record' }).click()

  await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  await expect(page.getByText('#1')).toBeVisible()
})

test.describe('allow multiple values', () => {
  test('is offered for SELECT and RELATION only', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])
    const multiple = page.getByLabel('Allow multiple values')

    await page.goto(table.settingsUrl)
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

    await page.goto(table.settingsUrl)
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

    await page.goto(table.settingsUrl)
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByLabel('Allow multiple values')).toBeEnabled()
  })
})

test('the type of an existing field cannot be changed', async ({ page, seedTable }) => {
  const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

  await page.goto(table.settingsUrl)
  await page.getByRole('button', { name: 'Edit' }).first().click()

  await expect(page.getByLabel('Type')).toBeDisabled()
})

test('a field row states its type, its configuration and its key', async ({ page, seedTable }) => {
  const people = await seedTable('People', [{ key: 'full_name', type: 'TEXT', name: 'Full name' }])
  const deals = await seedTable('Deals', [
    { key: 'company', type: 'TEXT', name: 'Company', required: true },
    {
      key: 'stage',
      type: 'SELECT',
      name: 'Stage',
      options: {
        choices: [
          { value: 'Won', color: 'green' },
          { value: 'Lost', color: 'red' },
        ],
        multiple: true,
      },
    },
    {
      key: 'owner',
      type: 'RELATION',
      name: 'Owner',
      options: { targetTableId: people.id, labelFieldKey: 'full_name' },
    },
  ])

  await page.goto(deals.settingsUrl)

  await expect(page.getByText('2 choices')).toBeVisible()
  await expect(page.getByText('multiple values')).toBeVisible()
  await expect(page.getByText('links to People')).toBeVisible()
  await expect(page.getByText('company', { exact: true })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Edit field Company' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete field Stage' })).toBeVisible()
})

test.describe('the table itself', () => {
  test('can be renamed from its settings page', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

    await page.goto(table.settingsUrl)
    await page.getByRole('button', { name: 'Rename' }).click()
    await page.getByLabel('Table name').fill('Contracts')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Contracts' })).toBeVisible()
    await expect(
      page
        .getByRole('navigation', { name: 'Your tables' })
        .getByRole('link', { name: /Contracts/ }),
    ).toBeVisible()
  })

  test('can be deleted from its settings page, landing on the dashboard', async ({
    page,
    seedTable,
  }) => {
    const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

    await page.goto(table.settingsUrl)
    await page.getByRole('button', { name: 'Delete table' }).click()
    await confirmDeletion(page)

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
  })

  test('refuses to delete while another table links to it, and names the field', async ({
    page,
    seedTable,
  }) => {
    const people = await seedTable('People', [
      { key: 'full_name', type: 'TEXT', name: 'Full name' },
    ])
    await seedTable('Deals', [
      {
        key: 'owner',
        type: 'RELATION',
        name: 'Owner',
        options: { targetTableId: people.id, labelFieldKey: 'full_name' },
      },
    ])

    await page.goto(people.settingsUrl)
    await page.getByRole('button', { name: 'Delete table' }).click()
    await confirmDeletion(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/"Owner" in "Deals" links to this table/)).toBeVisible()
    await expect(page).toHaveURL(people.settingsUrl)
  })
})
