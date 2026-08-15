import { confirmDeletion, expect, test } from '~~/test/e2e/setup/fixtures'

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

/**
 * The settings page states a field's *configuration*, not only its name — the whole reason the
 * row has a second line. Reading a table's shape must not require opening a dialog per row.
 */
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

  await page.goto(`/tables/${deals.id}`)

  await expect(page.getByText('2 choices')).toBeVisible()
  await expect(page.getByText('multiple values')).toBeVisible()
  // Resolved through the tables store — the field metadata carries only the target's id
  await expect(page.getByText('links to People')).toBeVisible()
  await expect(page.getByText('company', { exact: true })).toBeVisible()

  // Icon-only row actions, so the accessible name is the *only* name — and it names its field,
  // or six identical "Edit" buttons is what a screen reader hears
  await expect(page.getByRole('button', { name: 'Edit field Company' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete field Stage' })).toBeVisible()
})

test.describe('the table itself', () => {
  test('can be renamed from its settings page', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [{ key: 'company', type: 'TEXT', name: 'Company' }])

    await page.goto(`/tables/${table.id}`)
    await page.getByRole('button', { name: 'Rename' }).click()
    await page.getByLabel('Table name').fill('Contracts')
    await page.getByRole('button', { name: 'Save' }).click()

    // The heading reads the tables store, which the rename writes — so it and the sidebar move
    // together with no refetch. Reading only the page's own fetched copy would leave both stale.
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

    await page.goto(`/tables/${table.id}`)
    await page.getByRole('button', { name: 'Delete table' }).click()
    await confirmDeletion(page)

    // Deleting the table leaves nowhere to stand, so the navigation is part of the removal
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
  })

  /**
   * The refusal path, which is the reason `useDeleteConfirm` surfaces the server's message
   * rather than rethrowing: the dialog has to stay open and say which field is in the way.
   */
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

    await page.goto(`/tables/${people.id}`)
    await page.getByRole('button', { name: 'Delete table' }).click()
    await confirmDeletion(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/"Owner" in "Deals" links to this table/)).toBeVisible()
    await expect(page).toHaveURL(`/tables/${people.id}`)
  })
})
