import { expect, openRecordForm, test } from '~~/test/e2e/setup/fixtures'
import type { ISeededTable } from '~~/test/e2e/setup/fixtures'

/**
 * The searchable branch as a text field: typing, pasting, clearing, and the overlay that draws
 * the selection over the input. All of it is about the input and its panel staying in step —
 * the kind of thing that is obvious the moment it breaks and invisible until then.
 */

let table: ISeededTable

const MANY = Array.from({ length: 20 }, (_, index) => ({
  value: `Choice ${String(index + 1).padStart(2, '0')}`,
  color: 'gray' as const,
}))

const combo = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('dialog').getByRole('combobox', { name })

test.beforeEach(async ({ seedTable }) => {
  table = await seedTable('Deals', [
    { key: 'company', type: 'TEXT', name: 'Company' },
    { key: 'many', type: 'SELECT', name: 'Many', options: { choices: MANY } },
    {
      key: 'tags',
      type: 'SELECT',
      name: 'Tags',
      options: { choices: MANY, multiple: true },
    },
  ])
})

test.describe('typing', () => {
  test('opens the panel and filters as you go', async ({ page }) => {
    await openRecordForm(page, table.url)

    await combo(page, 'Many').pressSequentially('Choice 1')

    await expect(page.getByRole('listbox')).toBeVisible()
    // 10 and 12–19 survive "Choice 1"; 01 does not
    await expect(page.getByRole('option', { name: 'Choice 01', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'Choice 12', exact: true })).toBeVisible()
  })

  test('a paste opens and filters it just as a keystroke does', async ({ page }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Many')
    await input.focus()

    // Set the value and fire the same event a paste does — Playwright cannot paste directly
    await input.evaluate((element: HTMLInputElement) => {
      element.value = 'Choice 12'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: 'Choice 12', exact: true })).toBeVisible()
  })

  /** A SELECT's choices are already in hand, so filtering them must not go to the server. */
  test('filters locally, issuing no request', async ({ page }) => {
    await openRecordForm(page, table.url)

    // Data endpoints only: opening the panel pulls its tick icon from `/api/_nuxt_icon/`, which
    // is an asset rather than a lookup and would make an "any request" count meaningless
    const dataRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/tables/')) dataRequests.push(request.url())
    })

    await combo(page, 'Many').pressSequentially('Choice 1')
    await expect(page.getByRole('listbox')).toBeVisible()

    expect(dataRequests).toEqual([])
  })

  test('hides the selection overlay while a term is typed, and restores it when cleared', async ({
    page,
  }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Many')

    await input.click()
    await page.getByRole('option', { name: 'Choice 03', exact: true }).click()
    await expect(page.locator('.base-select__value')).toContainText('Choice 03')

    await input.pressSequentially('Cho')
    await expect(page.locator('.base-select__value')).toBeHidden()

    await input.fill('')
    await expect(page.locator('.base-select__value')).toContainText('Choice 03')
  })

  test('never shows the native placeholder under a selection', async ({ page }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Many')

    await expect(input).toHaveAttribute('placeholder')

    await input.click()
    await page.getByRole('option', { name: 'Choice 03', exact: true }).click()

    // The overlay draws the value, so the attribute is dropped entirely rather than blanked —
    // a placeholder showing through a selection is the bug this guards
    await expect(input).not.toHaveAttribute('placeholder')
  })
})

test.describe('picking several', () => {
  test('keeps the term editable after picking with the mouse', async ({ page }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Tags')

    await input.pressSequentially('Choice 1')
    await page.getByRole('option', { name: 'Choice 12', exact: true }).click()

    await input.pressSequentially('3')
    await expect(input).toHaveValue(/3/)
  })

  test('Backspace on an empty term drops one value per press', async ({ page }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Tags')

    await input.click()
    await page.getByRole('option', { name: 'Choice 01', exact: true }).click()
    await page.getByRole('option', { name: 'Choice 02', exact: true }).click()
    await page.getByRole('option', { name: 'Choice 03', exact: true }).click()
    await expect(page.locator('.base-select__value')).toContainText('3')

    await input.press('Backspace')
    await expect(page.locator('.base-select__value')).toContainText('2')

    await input.press('Backspace')
    await expect(page.locator('.base-select__value')).toContainText('1')
  })

  /**
   * Approximated: a held key is not reproducible through Playwright's API, so this presses
   * more times than there are values. What it can prove is that the presses past the end are
   * harmless — the selection empties on the first and the extra five change nothing.
   *
   * Asserted on the value overlay, not on the input: nothing is ever typed here, so the
   * field's own value is `''` throughout and could never have failed.
   */
  test('stops at empty rather than running away', async ({ page }) => {
    await openRecordForm(page, table.url)
    const input = combo(page, 'Tags')
    const value = page.locator('.base-select__value')

    await input.click()
    await page.getByRole('option', { name: 'Choice 01', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(value).toContainText('Choice 01')

    await input.press('Backspace')
    await expect(value).toBeHidden()

    // Five more than there is anything to remove
    for (let press = 0; press < 5; press += 1) await input.press('Backspace')

    await expect(value).toBeHidden()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test('clearing leaves focus in the control, never on the body', async ({ page }) => {
  await openRecordForm(page, table.url)
  const input = combo(page, 'Many')

  await input.click()
  await page.getByRole('option', { name: 'Choice 03', exact: true }).click()

  await page.getByRole('button', { name: /^Clear/ }).click()

  await expect(page.locator('.base-select__value')).toBeHidden()
  await expect(page.evaluate(() => document.activeElement?.tagName ?? '')).resolves.not.toBe('BODY')
})

/**
 * A relation's candidates are records of another table, so unlike a SELECT this one genuinely
 * has to ask the server — including for a single character, since the seed list is capped and
 * anything past it is reached by naming it.
 */
test.describe('a relation picker', () => {
  let deals: ISeededTable

  test.beforeEach(async ({ seedTable }) => {
    const people = await seedTable(
      'Linked People',
      [{ key: 'full_name', type: 'TEXT', name: 'Full name' }],
      [{ full_name: 'Ada Lovelace' }, { full_name: 'Grace Hopper' }, { full_name: '' }],
    )

    // A distinct name: the outer beforeEach already seeded a table called Deals
    deals = await seedTable('Linked Deals', [
      { key: 'company', type: 'TEXT', name: 'Company' },
      {
        key: 'owner',
        type: 'RELATION',
        name: 'Owner',
        options: { targetTableId: people.id, labelFieldKey: 'full_name' },
      },
    ])
  })

  const openOwner = async (page: import('@playwright/test').Page) => {
    await page.goto(deals.url)
    await page.getByRole('button', { name: 'Add record' }).first().click()
    return combo(page, 'Owner')
  }

  test('searches on a single character, with no minimum', async ({ page }) => {
    const owner = await openOwner(page)
    await owner.pressSequentially('h')

    await expect(page.getByRole('option', { name: /Grace Hopper/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Ada Lovelace/ })).toHaveCount(0)
  })

  test('matches a wildcard literally rather than as a pattern', async ({ page }) => {
    const owner = await openOwner(page)
    await owner.pressSequentially('%')

    await expect(page.getByRole('option')).toHaveCount(0)
  })

  test('finds a blank-labelled record by its number', async ({ page }) => {
    const owner = await openOwner(page)
    await owner.pressSequentially('#3')

    await expect(page.getByRole('option', { name: '#3', exact: true })).toBeVisible()
  })

  /**
   * The number is what tells two same-named records apart, so the picker states it beside every
   * candidate — in an element of its own, which is what lets it be styled apart from the label.
   */
  test('offers each candidate as its number and label', async ({ page }) => {
    const owner = await openOwner(page)
    await owner.pressSequentially('lovelace')

    const option = page.getByRole('option', { name: /Ada Lovelace/ })
    await expect(option).toHaveText(/^#\d+ Ada Lovelace$/)
    await expect(option.locator('.linked-record__number')).toHaveText(/^#\d+$/)
  })

  test('returns to the seed when the term is cleared, with no stale result winning', async ({
    page,
  }) => {
    const owner = await openOwner(page)

    await owner.pressSequentially('hopper')
    await expect(page.getByRole('option', { name: /Grace Hopper/ })).toBeVisible()

    await owner.fill('')

    await expect(page.getByRole('option', { name: /Ada Lovelace/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Grace Hopper/ })).toBeVisible()
  })

  /**
   * The message reads by role rather than by text: it is on screen once, in the panel, and in the
   * accessibility tree once more, in the control's live region — a `getByText` matches both. The
   * dialog is a safe scope because this form holds exactly one select; Nuxt's own route announcer
   * is a `role="status"` too, but it lives outside the shell.
   */
  const announcement = (page: import('@playwright/test').Page) =>
    page.getByRole('dialog').getByRole('status')

  test('offers a working Retry when the server cannot be reached', async ({ page }) => {
    const owner = await openOwner(page)

    await page.route('**/fields/**/options**', (route) => route.abort())
    await owner.pressSequentially('ada')

    await expect(announcement(page)).toHaveText('Could not load options.')
    // The visible half: the panel draws the same sentence, with the button beside it
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()

    await page.unroute('**/fields/**/options**')
    await page.getByRole('button', { name: /try again|retry/i }).click()

    await expect(page.getByRole('option', { name: /Ada Lovelace/ })).toBeVisible()
  })

  /**
   * The keyboard route to that button, which is the browser's answer rather than happy-dom's:
   * the panel is teleported to `<body>`, so the real tab order runs past the entire app before
   * reaching it. Where focus *lands* on each press is pinned in `BaseSelect.search.nuxt.spec.ts`;
   * what only Chromium can say is what the **default** Tab does after we move focus out of the
   * panel — the two cases below split on exactly that.
   */
  test.describe('reaching Retry from the keyboard', () => {
    const retry = (page: import('@playwright/test').Page) =>
      // Page-level, not scoped to the dialog: the panel teleports out of it
      page.getByRole('button', { name: 'Retry', exact: true })

    /** Fails the one request and leaves the panel showing its Retry. */
    async function failedSearch(page: import('@playwright/test').Page) {
      const owner = await openOwner(page)

      await page.route('**/fields/**/options**', (route) => route.abort())
      await owner.pressSequentially('ada')
      await expect(retry(page)).toBeVisible()

      return owner
    }

    test('Tab reaches it, Shift+Tab returns, and pressing it keeps focus in the field', async ({
      page,
    }) => {
      const owner = await failedSearch(page)

      await page.keyboard.press('Tab')
      await expect(retry(page)).toBeFocused()

      await page.keyboard.press('Shift+Tab')
      await expect(owner).toBeFocused()
      // Backwards is a return, not an exit — the panel is still there to go forward into
      await expect(retry(page)).toBeVisible()

      await page.unroute('**/fields/**/options**')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      // The button unmounts the moment the status changes, so this is the assertion that would
      // catch focus being dropped on `<body>`
      await expect(owner).toBeFocused()
      await expect(page.getByRole('option', { name: /Ada Lovelace/ })).toBeVisible()
    })

    /**
     * The half that rests on the browser: the handler closes the panel and hands focus back to
     * the control **without** cancelling the default, so Chromium must sequence from there. If it
     * sequenced from the teleported button instead, focus would land somewhere past the whole app
     * — which is what asserting the very next control catches.
     */
    test('Tab past it closes the panel and carries on to the next control', async ({ page }) => {
      await failedSearch(page)

      await page.keyboard.press('Tab')
      await expect(retry(page)).toBeFocused()

      await page.keyboard.press('Tab')

      await expect(page.getByRole('listbox')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Create record' })).toBeFocused()
    })
  })
})

test('a choice keeps its colour in the trigger, the options and the cell', async ({
  page,
  seedTable,
}) => {
  const coloured = await seedTable(
    'Coloured',
    [
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
    ],
    [{ stage: 'Won' }],
  )

  const tint = (locator: import('@playwright/test').Locator) =>
    locator.evaluate((element) => getComputedStyle(element).getPropertyValue('--badge-bg').trim())

  await page.goto(coloured.url)

  // In the cell
  const cellBadge = page.locator('tbody .base-badge').first()
  await expect(cellBadge).toContainText('Won')
  const cellTint = await tint(cellBadge)
  expect(cellTint).not.toBe('')

  // In every option row
  await page.getByRole('button', { name: 'Add record' }).first().click()
  const trigger = page.getByRole('dialog').getByRole('button', { name: /^Stage/ })
  await trigger.click()

  const wonOption = page.getByRole('option', { name: 'Won', exact: true }).locator('.base-badge')
  expect(await tint(wonOption)).toBe(cellTint)

  const lostOption = page.getByRole('option', { name: 'Lost', exact: true }).locator('.base-badge')
  expect(await tint(lostOption)).not.toBe(cellTint)

  // And in the trigger — drawn by the value overlay, which is a *sibling* of the button rather
  // than a child of it, so it is located from the control rather than from the trigger
  await page.getByRole('option', { name: 'Won', exact: true }).click()
  const triggerBadge = page.getByRole('dialog').locator('.base-select__value .base-badge')
  await expect(triggerBadge).toContainText('Won')
  expect(await tint(triggerBadge)).toBe(cellTint)
})
