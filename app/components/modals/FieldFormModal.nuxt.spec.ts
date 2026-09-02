import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { nextTick } from 'vue'
import { BADGE_COLOR_LABELS, DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import type { IField } from '#shared/types/field'
import { createError } from 'h3'
import FieldFormModal from '~/components/modals/FieldFormModal.vue'
import { useTablesStore } from '~/stores/tables'
import { asMultiple, relationField, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The field editor — the one form whose shape changes with what is being edited. Built on
 * `BaseModal`, so its body is teleported and every query goes to the document.
 *
 * The two fetches are registered rather than stubbed: the modal refreshes the table list itself
 * (for RELATION only, which is what the gating case counts) and reads the *target* table's
 * fields directly rather than through the fields store, which would be clobbered.
 */
const TABLES = [
  { id: 'tbl_deals', name: 'Deals', _count: { fields: 2, records: 3 } },
  { id: 'tbl_people', name: 'People', _count: { fields: 1, records: 2 } },
]

/** The target table's fields, swapped per case. */
let targetFields: IField[] = []

/** Flipped per case, so a load failure can be asserted rather than only a successful one. */
let tablesFail = false
let targetFieldsFail = false

/** Counted, because "did not fetch" is the whole claim of the gating case below. */
let tablesRequests = 0

function refuse(): never {
  throw createError({ statusCode: 500, statusMessage: 'Nope' })
}

registerEndpoint('/api/tables', () => {
  tablesRequests += 1
  if (tablesFail) refuse()

  return { tables: TABLES }
})
registerEndpoint('/api/tables/tbl_people/fields', () => {
  if (targetFieldsFail) refuse()

  return { fields: targetFields }
})
registerEndpoint('/api/tables/tbl_deals/fields', () => ({ fields: [] }))

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const text = () => dialog()?.textContent ?? ''

const labelled = (label: string) =>
  [...(dialog()?.querySelectorAll('label') ?? [])].find(
    (element) => element.textContent?.trim() === label,
  )

/**
 * A control found through its own label, the way a user reaches it. Two shapes to cover:
 * `BaseInput` and `BaseSelect` point at their control with `for`, while `BaseCheckbox` wraps
 * its `<input>` inside the `<label>` and needs none.
 */
const controlFor = (label: string) => {
  const element = labelled(label)
  const id = element?.getAttribute('for')

  return id
    ? dialog()?.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`)
    : (element?.querySelector<HTMLInputElement>('input') ?? undefined)
}

const choiceInputs = () => [
  ...(dialog()?.querySelectorAll<HTMLInputElement>('.field-form__choice input[type="text"]') ?? []),
]

const button = (name: string) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find((element) =>
    element.textContent?.trim().startsWith(name),
  )

const iconButton = (label: string) =>
  [...(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter(
    (element) => element.getAttribute('aria-label') === label,
  )

function mountForm(props: Record<string, unknown> = {}) {
  return mountTracked(FieldFormModal, {
    props: { mode: 'create', submitHandler: vi.fn(async () => {}), ...props } as never,
  })
}

describe('FieldFormModal', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    targetFields = []
    tablesFail = false
    targetFieldsFail = false
    tablesRequests = 0

    // The store is the Nuxt app's, so it outlives a case — a list left behind would make a
    // failure case look like it had loaded (`CLAUDE.md` §10)
    const tables = useTablesStore()
    tables.tables = []
    tables.loaded = false
    tables.failed = false

    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('what the form offers for a type', () => {
    it('shows the choices editor only for SELECT', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: textField() })
      expect(dialog()?.querySelector('.field-form__choices')).toBeNull()
      wrapper.unmount()
      document.body.innerHTML = ''

      await mountForm({ mode: 'edit', field: selectField() })
      expect(dialog()?.querySelector('.field-form__choices')).not.toBeNull()
    })

    /**
     * Cardinality is per-field rather than a second field type, and only the two types with a
     * list form may carry it — `MULTI_VALUE_BY_TYPE` is the guard, not a hardcoded pair here.
     */
    it('offers “Allow multiple values” only where the type has a list form', async () => {
      const single = await mountForm({ mode: 'edit', field: textField() })
      expect(labelled('Allow multiple values')).toBeUndefined()
      single.unmount()
      document.body.innerHTML = ''

      await mountForm({ mode: 'edit', field: selectField() })
      expect(labelled('Allow multiple values')).toBeDefined()
    })

    it('locks the type of a field that already exists', async () => {
      await mountForm({ mode: 'edit', field: textField() })

      expect(controlFor('Type')?.hasAttribute('disabled')).toBe(true)
    })
  })

  /**
   * Read off the **saved** field, not the form: ticking the box in this session must not lock
   * it, because only an already-stored multi-value field is one the server refuses to narrow.
   */
  describe('the multi-value lock', () => {
    it('stays open while the saved field is still single-value', async () => {
      await mountForm({ mode: 'edit', field: selectField() })

      const checkbox = controlFor('Allow multiple values')
      expect(checkbox?.disabled).toBe(false)
      expect(text()).not.toContain('cannot be changed back')
    })

    it('closes once the field is saved as multi-value, and says why', async () => {
      await mountForm({ mode: 'edit', field: asMultiple(selectField()) })

      expect(controlFor('Allow multiple values')?.disabled).toBe(true)
      expect(text()).toContain('cannot be changed back to a single value')
    })

    it('does not lock the moment the box is ticked in this session', async () => {
      await mountForm({ mode: 'edit', field: selectField() })

      const checkbox = controlFor('Allow multiple values')!
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      await nextTick()

      expect(controlFor('Allow multiple values')?.disabled).toBe(false)
    })
  })

  describe('the choices editor', () => {
    it('adds a blank choice in the default colour', async () => {
      await mountForm({ mode: 'edit', field: selectField(['Won']) })
      expect(choiceInputs()).toHaveLength(1)

      button('Add choice')?.click()
      await nextTick()

      const inputs = choiceInputs()
      expect(inputs).toHaveLength(2)
      expect(inputs[1]?.value).toBe('')

      // The colour picker names its current colour, so the default is readable off the label
      const pickers = [...(dialog()?.querySelectorAll('.base-color-picker__trigger') ?? [])]
      expect(pickers).toHaveLength(2)
      expect(pickers[1]?.getAttribute('aria-label')).toContain(
        BADGE_COLOR_LABELS[DEFAULT_BADGE_COLOR],
      )
    })

    /**
     * Rows carry an identity of their own because a choice has none — its `value` is still
     * being typed. Keying by index would shift every row below a removal onto the wrong state
     * and colour, so the middle row is the one worth removing.
     */
    it('removes the row asked for, leaving the others intact', async () => {
      await mountForm({
        mode: 'edit',
        field: selectField(['Won', 'Lost', 'Open']),
      })
      expect(choiceInputs().map((input) => input.value)).toEqual(['Won', 'Lost', 'Open'])

      iconButton('Remove choice')[1]?.click()
      await nextTick()

      expect(choiceInputs().map((input) => input.value)).toEqual(['Won', 'Open'])
    })

    /**
     * Choices are copied one level deep, because a choice is an object: sharing the references
     * would let an edit here mutate the store's field metadata and repaint the page behind.
     */
    it('never writes through to the field it was opened with', async () => {
      const field = selectField([{ value: 'Won', color: 'green' }])
      await mountForm({ mode: 'edit', field })

      const input = choiceInputs()[0]!
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      expect(field.options?.choices?.[0]?.value).toBe('Won')
    })
  })

  /**
   * A relation's label options come from the *target* table, fetched when the target changes.
   * A link labelled by another link would read as an id, and a multi-value field names nothing,
   * so neither is offered.
   */
  describe('a relation’s label field', () => {
    it('offers the target’s labellable fields once it is chosen', async () => {
      targetFields = [
        textField('full_name', { name: 'Full name' }),
        relationField({}, { key: 'manager', name: 'Manager' }),
        asMultiple(selectField(['a'], { key: 'tags', name: 'Tags' })),
      ]

      await mountForm({
        mode: 'edit',
        field: relationField({ targetTableId: 'tbl_people', labelFieldKey: 'full_name' }),
      })
      await nextTick()

      const labelSelect = dialog()?.querySelector('.base-select__value, .base-select__input')
      expect(labelSelect).not.toBeNull()
      // The relation and the multi-value field are not candidates; the text field is
      await expect.poll(() => text()).toContain('Full name')
    })

    it('keeps a label choice the target still has', async () => {
      targetFields = [
        textField('full_name', { name: 'Full name' }),
        textField('email', { name: 'Email' }),
      ]

      await mountForm({
        mode: 'edit',
        field: relationField({ targetTableId: 'tbl_people', labelFieldKey: 'email' }),
      })

      await expect.poll(() => text()).toContain('Email')
    })
  })

  /**
   * Neither option list may report "there are none" while the answer is unknown or the request
   * failed — that states something about the user's data nobody established (`CLAUDE.md` §7).
   */
  describe('when an option list cannot be loaded', () => {
    const loadError = () => dialog()?.querySelector('.field-form__load-error')?.textContent ?? ''

    const relation = () =>
      mountForm({
        mode: 'edit',
        field: relationField({ targetTableId: 'tbl_people', labelFieldKey: 'full_name' }),
      })

    it('says the table list failed rather than that there are no tables', async () => {
      tablesFail = true

      await relation()

      await expect.poll(loadError).toContain('Couldn’t load your tables')
      expect(text()).not.toContain('No other tables yet')
    })

    it('reloads the table list from its own Try again', async () => {
      tablesFail = true
      await relation()
      await expect.poll(loadError).toContain('Couldn’t load your tables')

      tablesFail = false
      button('Try again')?.click()

      // Waited on what the retry must *produce*: the message clears the instant the request
      // starts, so polling it would resolve before anything had loaded (`CLAUDE.md` §10)
      await expect.poll(() => useTablesStore().tables).toHaveLength(TABLES.length)
      expect(loadError()).toBe('')
    })

    it('says the field list failed rather than that the table has no fields', async () => {
      targetFieldsFail = true

      await relation()

      await expect.poll(loadError).toContain('Couldn’t load that table’s fields')
      expect(text()).not.toContain('That table has no fields to label by')
    })

    it('reloads the field list from its own Try again', async () => {
      targetFieldsFail = true
      await relation()
      await expect.poll(loadError).toContain('Couldn’t load that table’s fields')

      targetFieldsFail = false
      targetFields = [textField('full_name', { name: 'Full name' })]
      button('Try again')?.click()

      await expect.poll(() => text()).toContain('Full name')
      expect(loadError()).toBe('')
    })

    /**
     * Only the type that renders a target select reads the list, so no other type pays for a
     * table fetch with its per-table counts.
     */
    it('does not ask for the table list for a type that cannot link', async () => {
      await mountForm({ mode: 'edit', field: textField() })
      await nextTick()

      expect(tablesRequests).toBe(0)
    })
  })

  it('surfaces a refusal from the server as an alert', async () => {
    await mountForm({
      mode: 'create',
      submitHandler: vi.fn(async () => {
        throw { data: { statusMessage: 'A field with that key already exists' } }
      }),
    })

    const name = controlFor('Field name')!
    name.value = 'Company'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    dialog()
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true }))

    await expect
      .poll(() => document.querySelector('[role="alert"]')?.textContent)
      .toContain('A field with that key already exists')
  })
})
