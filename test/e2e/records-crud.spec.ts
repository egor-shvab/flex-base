import { confirmDeletion, expect, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * Record CRUD across **every** field type, through the generated form and the generated table.
 * The point is that no per-type code exists on either side: one form renders all six, and one
 * table renders them back.
 */

test.describe('every field type', () => {
  let table: ISeededTable

  test.beforeEach(async ({ seedTable }) => {
    table = await seedTable('Deals', [
      { key: 'company', type: 'TEXT', name: 'Company' },
      { key: 'contract_value', type: 'NUMBER', name: 'Contract value' },
      { key: 'active', type: 'BOOLEAN', name: 'Active' },
      { key: 'signed_on', type: 'DATE', name: 'Signed on' },
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
    ])
  })

  test('creates a record filling in each type', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()

    await page.getByLabel('Company').fill('Acme')
    await page.getByLabel('Contract value').fill('1200')
    await page.getByLabel('Active').check()
    await page.getByLabel('Signed on').fill('2026-03-04')
    await page.getByLabel('Stage').click()
    await page.getByRole('option', { name: 'Won', exact: true }).click()

    await page.getByRole('button', { name: 'Create record' }).click()

    const row = page.getByRole('row').filter({ hasText: 'Acme' })
    await expect(row).toContainText('1,200')
    await expect(row).toContainText('Yes')
    await expect(row).toContainText('04 Mar 2026')
    await expect(row).toContainText('Won')
  })

  test('edits a record, and the table shows the new value', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByLabel('Company').fill('Acme')
    await page.getByRole('button', { name: 'Create record' }).click()
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit record' }).click()
    await page.getByLabel('Company').fill('Acme Renamed')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('cell', { name: 'Acme Renamed' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Acme', exact: true })).toBeHidden()
  })

  test('deletes a record only after confirming', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByLabel('Company').fill('Acme')
    await page.getByRole('button', { name: 'Create record' }).click()
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete record' }).click()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete record' }).click()
    await confirmDeletion(page)

    await expect(page.getByRole('cell', { name: 'Acme' })).toBeHidden()
  })

  test('shows an unfilled value as Not set rather than blank', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByLabel('Company').fill('Sparse')
    await page.getByRole('button', { name: 'Create record' }).click()

    const row = page.getByRole('row').filter({ hasText: 'Sparse' })
    await expect(row).toContainText('Not set')
  })

  /**
   * The NUMBER control is a native number input, so letters never become a value in the first
   * place — the schema's rejection of a non-numeric payload is a server concern and is covered
   * there. What only a browser can show is that the control refuses the keystrokes.
   */
  test('will not let letters into a number field at all', async ({ page }) => {
    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()

    const value = page.getByLabel('Contract value')
    await expect(value).toHaveAttribute('type', 'number')

    await value.pressSequentially('not a number')
    await expect(value).toHaveValue('')

    // Cleared first: the control keeps the rejected text in its buffer, so appending digits to
    // it would still read as invalid — which is the browser's behaviour, not a bug
    await value.fill('')
    await value.pressSequentially('1200')
    await expect(value).toHaveValue('1200')
  })
})

test.describe('a required field', () => {
  test('blocks the form until it is filled, naming the field', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [
      { key: 'company', type: 'TEXT', name: 'Company', required: true },
    ])

    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByRole('button', { name: 'Create record' }).click()

    // The field's own name, not a bare "required": the schema emits `${field.name} is
    // required` per field, and a form that said only "required" would leave the user hunting
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Company is required')).toBeVisible()
  })

  /** `false` is a real value, so a checkbox can never be "missing" — a documented no-op. */
  test('is a no-op on a checkbox', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [
      { key: 'active', type: 'BOOLEAN', name: 'Active', required: true },
    ])

    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByRole('button', { name: 'Create record' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('cell', { name: 'No' })).toBeVisible()
  })
})

test.describe('a multi-value field', () => {
  test('holds several values, and reads Not set once cleared', async ({ page, seedTable }) => {
    const table = await seedTable(
      'Deals',
      [
        {
          key: 'tags',
          type: 'SELECT',
          name: 'Tags',
          options: {
            choices: [
              { value: 'urgent', color: 'red' },
              { value: 'renewal', color: 'blue' },
            ],
            multiple: true,
          },
        },
      ],
      [{ tags: ['urgent', 'renewal'] }, { tags: [] }],
    )

    await page.goto(table.url)

    await expect(page.getByRole('row').filter({ hasText: 'urgent' })).toContainText('renewal')
    // An empty list is as blank as a null — not a blank cell
    await expect(page.getByRole('cell', { name: 'Not set' })).toBeVisible()
  })

  test('fails per-field when required and nothing is chosen', async ({ page, seedTable }) => {
    const table = await seedTable('Deals', [
      {
        key: 'tags',
        type: 'SELECT',
        name: 'Tags',
        required: true,
        options: { choices: [{ value: 'urgent', color: 'red' }], multiple: true },
      },
    ])

    await page.goto(table.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    await page.getByRole('button', { name: 'Create record' }).click()

    // "Per-field" is the claim, so the field's own message is what proves it — a dialog that
    // merely stayed open would satisfy a form-level error just as well
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Tags is required')).toBeVisible()
  })
})
