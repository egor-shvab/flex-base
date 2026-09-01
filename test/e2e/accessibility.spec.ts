import type { Locator, Page } from '@playwright/test'
import { expect, test } from '~~/test/e2e/setup/fixtures'
import { axeViolations, undersizedTargets } from '~~/test/e2e/setup/a11y'

/**
 * The two gates `CLAUDE.md` §8 asks for: an automated pass over the WCAG rules a machine can
 * check, and the 24×24 target floor. Both measurements live in `setup/a11y.ts`, since the mobile
 * shell runs them too, and both walk the same five screens.
 *
 * Neither replaces a keyboard walk — axe cannot tell whether a focus order makes sense — but
 * both catch what a walk misses precisely because nothing on screen looks different.
 */

/** One table of mixed types, so every screen below has real controls to audit. */
const FIELDS = [
  { key: 'company', type: 'TEXT' as const, name: 'Company' },
  { key: 'contract_value', type: 'NUMBER' as const, name: 'Contract value' },
  { key: 'active', type: 'BOOLEAN' as const, name: 'Active' },
  {
    key: 'stage',
    type: 'SELECT' as const,
    name: 'Stage',
    options: {
      choices: [
        { value: 'Won', color: 'green' as const },
        { value: 'Lost', color: 'red' as const },
      ],
    },
  },
]

const ROWS = [{ company: 'Acme', contract_value: 100, active: true, stage: 'Won' }]

/**
 * The five screens, each reached the way a user reaches it — a dialog opened by its own button
 * rather than by a URL, so what is audited is the DOM the app actually produces.
 */
test.describe('the five screens', () => {
  let url = ''
  let tableId = ''

  test.beforeEach(async ({ seedTable }) => {
    const table = await seedTable('Deals', FIELDS, ROWS)
    url = table.url
    tableId = table.id
  })

  const screens: Record<string, (page: Page) => Promise<void>> = {
    dashboard: async (page) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /your tables/i })).toBeVisible()
    },
    'table settings': async (page) => {
      await page.goto(`/tables/${tableId}/settings`)
      await expect(page.getByRole('heading', { name: 'Deals' })).toBeVisible()
    },
    'records list': async (page) => {
      await page.goto(url)
      await expect(page.getByRole('cell', { name: 'Acme' })).toBeVisible()
    },
    'the record form': async (page) => {
      await page.goto(url)
      await page.getByRole('button', { name: 'Add record' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    'the filter drawer': async (page) => {
      await page.goto(url)
      await page.getByRole('button', { name: 'Filters' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  }

  for (const [name, open] of Object.entries(screens)) {
    test(`${name} has no serious or critical accessibility violations`, async ({ page }) => {
      await open(page)

      expect(await axeViolations(page)).toEqual([])
    })

    test(`${name} has no target below 24×24`, async ({ page }) => {
      await open(page)

      expect(await undersizedTargets(page)).toEqual([])
    })
  }
})

/** `--color-focus` and `--color-accent-tint`, the two values the state is made of. */
const FOCUS = 'rgb(52, 120, 229)'
const HALO = '231, 238, 252'

const focusState = (locator: Locator) =>
  locator.evaluate((element) => {
    const { outlineStyle, outlineWidth, outlineColor, boxShadow, borderColor } =
      getComputedStyle(element)
    return {
      outlineStyle,
      width: Number.parseFloat(outlineWidth),
      outlineColor,
      boxShadow,
      borderColor,
    }
  })

/**
 * Both registers of the focus state, neither visible to a component spec (`test.css` is false).
 * The halo is the half that vanishes *silently*: a component's own `box-shadow` outranks it and
 * a clipping ancestor eats it. The field's `outline: none` is asserted for the mirror-image
 * reason — the baseline would otherwise redraw the ring that register exists to drop.
 */
test('a focused field recolours its border, and takes no ring', async ({ page, seedTable }) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(table.url)
  const search = page.getByRole('textbox', { name: 'Search this table' })
  await search.focus()

  const state = await focusState(search)

  expect(state.borderColor).toBe(FOCUS)
  expect(state.outlineStyle).toBe('none')
  expect(state.boxShadow).toContain(HALO)
})

test('a focused button takes the ring, since it has no border to recolour', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(table.url)
  // Keyboard modality first: `:focus-visible` does not match a script focus after a click
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: 'Add record' }).first().focus()

  const state = await focusState(page.getByRole('button', { name: 'Add record' }).first())

  expect(state.outlineStyle).toBe('solid')
  expect(state.width).toBeGreaterThan(0)
  expect(state.outlineColor).toBe(FOCUS)
  expect(state.boxShadow).toContain(HALO)
})

/**
 * The boundary case, asserted rather than excluded: the chip's remove button sits *exactly* on
 * the floor, so a padding change in either direction shows up here first.
 */
test('the filter-summary chip’s remove button sits exactly on the floor', async ({
  page,
  seedTable,
}) => {
  const table = await seedTable('Deals', FIELDS, ROWS)

  await page.goto(`${table.url}?stage=Won`)

  const remove = page.getByRole('button', { name: /Remove the Stage filter/i })
  const box = await remove.boundingBox()

  expect(box).not.toBeNull()
  expect(Math.round(box!.width)).toBe(24)
  expect(Math.round(box!.height)).toBe(24)
})
