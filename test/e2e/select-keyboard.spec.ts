import { expect, openRecordForm, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

let table: ISeededTable

const FEW = ['Won', 'Lost', 'Open'].map((value) => ({ value, color: 'gray' as const }))
const MANY = Array.from({ length: 20 }, (_, index) => ({
  value: `Choice ${String(index + 1).padStart(2, '0')}`,
  color: 'gray' as const,
}))

const fewTrigger = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog').getByRole('button', { name: /^Stage/ })

const manyTrigger = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog').getByRole('combobox', { name: 'Many' })

const activeOption = (page: import('@playwright/test').Page) =>
  page.locator('[role="option"].base-select__option--active')

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable('Deals', [
    { key: 'company', type: 'TEXT', name: 'Company' },
    { key: 'stage', type: 'SELECT', name: 'Stage', options: { choices: FEW } },
    { key: 'many', type: 'SELECT', name: 'Many', options: { choices: MANY } },
  ])
})

test('the keyboard cursor is visibly edged, not just class-marked', async ({ page }) => {
  await openRecordForm(page, table.url)
  await fewTrigger(page).focus()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')

  const active = activeOption(page)
  await expect(active).toHaveText('Lost')

  const edge = await active.evaluate((option) => getComputedStyle(option).boxShadow)

  expect(edge).toBe('rgb(28, 107, 74) 2px 0px 0px 0px inset')
})

test.describe('the searchable branch', () => {
  test('PageDown jumps further than a single step', async ({ page }) => {
    await openRecordForm(page, table.url)
    await manyTrigger(page).click()
    await page.keyboard.press('ArrowDown')
    await expect(activeOption(page)).toHaveText('Choice 01')

    await page.keyboard.press('PageDown')

    await expect(activeOption(page)).not.toHaveText('Choice 01')
    await expect(activeOption(page)).not.toHaveText('Choice 02')
  })

  test('the panel scrolls to keep the highlight in view', async ({ page }) => {
    await openRecordForm(page, table.url)
    await manyTrigger(page).click()
    await page.keyboard.press('ArrowDown')

    for (let step = 0; step < 19; step += 1) await page.keyboard.press('ArrowDown')
    await expect(activeOption(page)).toHaveText('Choice 20')

    const optionBox = await activeOption(page).boundingBox()
    const panelBox = await page.getByRole('listbox').boundingBox()

    expect(optionBox).not.toBeNull()
    expect(panelBox).not.toBeNull()
    expect(optionBox!.y).toBeGreaterThanOrEqual(panelBox!.y - 1)
    expect(optionBox!.y + optionBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height + 1)
  })
})

test('a panel low in the filter drawer stays on screen', async ({ page, seedTable }) => {
  const tall = await seedTable('Tall', [
    ...Array.from({ length: 8 }, (_, index) => ({
      key: `text_${index}`,
      type: 'TEXT' as const,
      name: `Text ${index}`,
    })),
    { key: 'stage', type: 'SELECT' as const, name: 'Stage', options: { choices: FEW } },
  ])

  await page.goto(tall.url)
  await page.getByRole('button', { name: 'Filters' }).click()

  const trigger = page.locator('.filter-panel').getByRole('button', { name: /^Stage/ })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()

  const panel = page.getByRole('listbox')
  await expect(panel).toBeVisible()

  const panelBox = await panel.boundingBox()
  const viewport = page.viewportSize()

  expect(panelBox).not.toBeNull()
  expect(panelBox!.y).toBeGreaterThanOrEqual(0)
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1)
})

test('a panel stays pinned to its trigger while the drawer scrolls', async ({
  page,
  seedTable,
}) => {
  const tall = await seedTable('Tall', [
    ...Array.from({ length: 10 }, (_, index) => ({
      key: `text_${index}`,
      type: 'TEXT' as const,
      name: `Text ${index}`,
    })),
    { key: 'stage', type: 'SELECT' as const, name: 'Stage', options: { choices: FEW } },
  ])

  await page.goto(tall.url)
  await page.getByRole('button', { name: 'Filters' }).click()

  const trigger = page.locator('.filter-panel').getByRole('button', { name: /^Stage/ })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()

  const panel = page.getByRole('listbox')
  await expect(panel).toBeVisible()

  const triggerBefore = (await trigger.boundingBox())!.y
  const panelBefore = (await panel.boundingBox())!.y

  // A programmatic scroll fires no `pointerdown`, so the panel is not dismissed
  await page.locator('.base-modal__body').evaluate((body) => body.scrollTo(0, 0))

  const triggerMoved = Math.round((await trigger.boundingBox())!.y - triggerBefore)
  expect(triggerMoved).not.toBe(0)

  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.y - panelBefore))
    .toBe(triggerMoved)
})

test.describe('Escape layering', () => {
  test('a closed non-searchable select lets the dialog behind it close', async ({ page }) => {
    await openRecordForm(page, table.url)
    await fewTrigger(page).focus()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('a closed searchable select does the same', async ({ page }) => {
    await openRecordForm(page, table.url)
    await manyTrigger(page).focus()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('an open select closes only its panel, and a second press closes the dialog', async ({
    page,
  }) => {
    await openRecordForm(page, table.url)
    await fewTrigger(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('the same holds for the searchable branch', async ({ page }) => {
    await openRecordForm(page, table.url)
    await manyTrigger(page).click()
    await expect(page.getByRole('listbox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('Enter in a form', () => {
  test('reaches the form when the select is closed, rather than being swallowed', async ({
    page,
  }) => {
    await openRecordForm(page, table.url)
    await page.getByLabel('Company').fill('Acme')

    await page.getByLabel('Company').press('Enter')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  })

  test('picks rather than submitting while the panel is open', async ({ page }) => {
    await openRecordForm(page, table.url)
    await fewTrigger(page).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')

    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(fewTrigger(page)).toHaveAccessibleName(/Won/)
  })
})
