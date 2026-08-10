import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { nextTick } from 'vue'
import { BADGE_COLOR_LABELS, DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import type { IField } from '#shared/types/field'
import FieldFormModal from '~/components/modals/FieldFormModal.vue'
import { asMultiple, relationField, selectField, textField } from '~~/test/fixtures'

/**
 * The field editor — the one form whose shape changes with what is being edited, and the only
 * place the metadata layer is authored rather than consumed. Built on `BaseModal`, so its body
 * is teleported and every query goes to the document.
 *
 * The two fetches are registered rather than stubbed: the modal refreshes the table list on
 * mount so it stays self-contained, and reads the *target* table's fields directly rather than
 * through the fields store, which holds the table being edited and would be clobbered.
 */
const TABLES = [
  { id: 'tbl_deals', name: 'Deals', _count: { fields: 2, records: 3 } },
  { id: 'tbl_people', name: 'People', _count: { fields: 1, records: 2 } },
]

/** The target table's fields, swapped per case. */
let targetFields: IField[] = []

registerEndpoint('/api/tables', () => ({ tables: TABLES }))
registerEndpoint('/api/tables/tbl_people/fields', () => ({ fields: targetFields }))
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
  return mountSuspended(FieldFormModal, {
    props: { mode: 'create', submitHandler: vi.fn(async () => {}), ...props } as never,
  })
}

describe('FieldFormModal', () => {
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    targetFields = []

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

      const selecting = await mountForm({ mode: 'edit', field: selectField() })
      expect(dialog()?.querySelector('.field-form__choices')).not.toBeNull()
      selecting.unmount()
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

      const multi = await mountForm({ mode: 'edit', field: selectField() })
      expect(labelled('Allow multiple values')).toBeDefined()
      multi.unmount()
    })

    it('locks the type of a field that already exists', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: textField() })

      expect(controlFor('Type')?.hasAttribute('disabled')).toBe(true)

      wrapper.unmount()
    })
  })

  /**
   * Read off the **saved** field rather than the form: ticking the box in this session must not
   * lock it, because only a field the server already stores as multi-value is one it refuses to
   * narrow. Widening migrates the rows that exist; narrowing would have to discard values.
   */
  describe('the multi-value lock', () => {
    it('stays open while the saved field is still single-value', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: selectField() })

      const checkbox = controlFor('Allow multiple values')
      expect(checkbox?.disabled).toBe(false)
      expect(text()).not.toContain('cannot be changed back')

      wrapper.unmount()
    })

    it('closes once the field is saved as multi-value, and says why', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: asMultiple(selectField()) })

      expect(controlFor('Allow multiple values')?.disabled).toBe(true)
      expect(text()).toContain('cannot be changed back to a single value')

      wrapper.unmount()
    })

    it('does not lock the moment the box is ticked in this session', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: selectField() })

      const checkbox = controlFor('Allow multiple values')!
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      await nextTick()

      expect(controlFor('Allow multiple values')?.disabled).toBe(false)

      wrapper.unmount()
    })
  })

  describe('the choices editor', () => {
    it('adds a blank choice in the default colour', async () => {
      const wrapper = await mountForm({ mode: 'edit', field: selectField(['Won']) })
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

      wrapper.unmount()
    })

    /**
     * Rows are keyed by an identity of their own because a choice has none — its `value` is
     * still being typed. Keying by index would let a removal shift every row below it onto the
     * wrong state, which now includes a colour, so the middle row is the one worth removing.
     */
    it('removes the row asked for, leaving the others intact', async () => {
      const wrapper = await mountForm({
        mode: 'edit',
        field: selectField(['Won', 'Lost', 'Open']),
      })
      expect(choiceInputs().map((input) => input.value)).toEqual(['Won', 'Lost', 'Open'])

      iconButton('Remove choice')[1]?.click()
      await nextTick()

      expect(choiceInputs().map((input) => input.value)).toEqual(['Won', 'Open'])

      wrapper.unmount()
    })

    /**
     * The choices are copied one level deeper than a spread, because a choice is an object now.
     * Sharing those references would let an edit here mutate the store's own field metadata —
     * repainting the page behind the modal before anything is saved.
     */
    it('never writes through to the field it was opened with', async () => {
      const field = selectField([{ value: 'Won', color: 'green' }])
      const wrapper = await mountForm({ mode: 'edit', field })

      const input = choiceInputs()[0]!
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      expect(field.options?.choices?.[0]?.value).toBe('Won')

      wrapper.unmount()
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

      const wrapper = await mountForm({
        mode: 'edit',
        field: relationField({ targetTableId: 'tbl_people', labelFieldKey: 'full_name' }),
      })
      await nextTick()

      const labelSelect = dialog()?.querySelector('.base-select__value, .base-select__input')
      expect(labelSelect).not.toBeNull()
      // The relation and the multi-value field are not candidates; the text field is
      await expect.poll(() => text()).toContain('Full name')

      wrapper.unmount()
    })

    it('keeps a label choice the target still has', async () => {
      targetFields = [
        textField('full_name', { name: 'Full name' }),
        textField('email', { name: 'Email' }),
      ]

      const wrapper = await mountForm({
        mode: 'edit',
        field: relationField({ targetTableId: 'tbl_people', labelFieldKey: 'email' }),
      })

      await expect.poll(() => text()).toContain('Email')

      wrapper.unmount()
    })
  })

  it('surfaces a refusal from the server as an alert', async () => {
    const wrapper = await mountForm({
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

    wrapper.unmount()
  })
})
