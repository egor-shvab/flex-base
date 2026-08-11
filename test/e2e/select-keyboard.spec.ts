import { expect, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * `BaseSelect` from the keyboard, in **both** its branches — which one a field gets is decided
 * by its choice count through `shouldSearch`, so the fixture below sits well either side of it
 * without naming the number, which is `app/utils/select.spec.ts`'s to pin.
 *
 * **The logic is pinned in happy-dom already**, and this file is deliberately only what a real
 * browser answers: whether the highlight is painted rather than merely class-marked, whether
 * the panel scrolls to follow it, whether a flipped panel is on screen rather than merely
 * positioned, and how Escape layers against the surface behind it. A case that would pass in
 * happy-dom belongs in `BaseSelect.nuxt.spec.ts`, where it runs in milliseconds.
 */

let table: ISeededTable

const FEW = ['Won', 'Lost', 'Open'].map((value) => ({ value, color: 'gray' as const }))
const MANY = Array.from({ length: 20 }, (_, index) => ({
  value: `Choice ${String(index + 1).padStart(2, '0')}`,
  color: 'gray' as const,
}))

/** Below the threshold: a button trigger over a listbox. */
const fewTrigger = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog').getByRole('button', { name: /^Stage/ })

/** Above it: the control *is* the search field, so the trigger is a combobox input. */
const manyTrigger = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog').getByRole('combobox', { name: 'Many' })

const activeOption = (page: import('@playwright/test').Page) =>
  page.locator('[role="option"].base-select__option--active')

async function openRecordForm(page: import('@playwright/test').Page) {
  await page.goto(table.url)
  await page.getByRole('button', { name: 'Add record' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable('Deals', [
    { key: 'company', type: 'TEXT', name: 'Company' },
    { key: 'stage', type: 'SELECT', name: 'Stage', options: { choices: FEW } },
    { key: 'many', type: 'SELECT', name: 'Many', options: { choices: MANY } },
  ])
})

/**
 * Where the cursor *lands* — on opening, on ↑/↓, on Home/End, on a printable key — is pinned
 * in `BaseSelect.nuxt.spec.ts`, assertion for assertion. Repeating it here bought a slower copy
 * of the same answer.
 *
 * What no component spec can reach is whether the highlight is **painted**: `--active` renders
 * an inset outline, and Vitest keeps `test.css: false`, so happy-dom sees the class and nothing
 * else. A cursor the user cannot see is the failure this one case exists for.
 */
test('the keyboard cursor is visibly outlined, not just class-marked', async ({ page }) => {
  await openRecordForm(page)
  await fewTrigger(page).focus()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')

  const active = activeOption(page)
  await expect(active).toHaveText('Lost')

  const outline = await active.evaluate((option) => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(option)
    return { outlineStyle, width: Number.parseFloat(outlineWidth), outlineColor }
  })

  expect(outline.outlineStyle).toBe('solid')
  expect(outline.width).toBeGreaterThan(0)
  expect(outline.outlineColor).not.toBe('rgba(0, 0, 0, 0)')
})

test.describe('the searchable branch', () => {
  test('PageDown jumps further than a single step', async ({ page }) => {
    await openRecordForm(page)
    // Opening already seeds the cursor — on the current value, or on the first option when
    // there is none — so no ArrowDown is needed to get a highlight
    await manyTrigger(page).click()
    await expect(activeOption(page)).toHaveText('Choice 01')

    await page.keyboard.press('PageDown')

    await expect(activeOption(page)).not.toHaveText('Choice 01')
    await expect(activeOption(page)).not.toHaveText('Choice 02')
  })

  /** A highlight that has scrolled out of sight is no highlight at all. */
  test('the panel scrolls to keep the highlight in view', async ({ page }) => {
    await openRecordForm(page)
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
  // Enough fields that the last control sits near the bottom of the drawer, where a panel
  // opening downwards would run off the viewport
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

/**
 * The other half of the same problem, and the reason `useAnchoredPosition` listens for scroll
 * in **capture** phase: the panel is teleported to `<body>`, so it is not inside the drawer
 * that scrolls under it. Nothing repositions it but that listener, and a panel left behind
 * where it was first drawn points at whatever control has since scrolled into its place.
 *
 * Asserted as a delta rather than a coordinate — the panel must move by exactly what its
 * trigger moved, which encodes no viewport arithmetic and survives a change of drawer height.
 */
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

  // Back to the top of the drawer, which is as far as the trigger can travel. A programmatic
  // scroll fires no `pointerdown`, so the panel is not dismissed on the way.
  await page.locator('.base-modal__body').evaluate((body) => body.scrollTo(0, 0))

  const triggerMoved = Math.round((await trigger.boundingBox())!.y - triggerBefore)
  // Or the case would pass against a drawer that never scrolled and a panel that never moved
  expect(triggerMoved).not.toBe(0)

  // The handler coalesces into an animation frame, so the panel follows a beat behind
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.y - panelBefore))
    .toBe(triggerMoved)
})

/**
 * The case that is silent when broken: one keypress must never close both the panel and the
 * surface behind it, and a **closed** control must not swallow the key at all.
 */
test.describe('Escape layering', () => {
  test('a closed non-searchable select lets the dialog behind it close', async ({ page }) => {
    await openRecordForm(page)
    await fewTrigger(page).focus()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('a closed searchable select does the same', async ({ page }) => {
    await openRecordForm(page)
    await manyTrigger(page).focus()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('an open select closes only its panel, and a second press closes the dialog', async ({
    page,
  }) => {
    await openRecordForm(page)
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
    await openRecordForm(page)
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
    await openRecordForm(page)
    await page.getByLabel('Company').fill('Acme')

    await page.getByLabel('Company').press('Enter')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
  })

  test('picks rather than submitting while the panel is open', async ({ page }) => {
    await openRecordForm(page)
    await fewTrigger(page).focus()
    await page.keyboard.press('Enter')
    // Enter opened it on the first choice, so one step down lands on the second
    await page.keyboard.press('ArrowDown')

    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('listbox')).toBeHidden()
    await expect(fewTrigger(page)).toHaveAccessibleName(/Lost/)
  })
})
