import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import BaseModal from '~/components/common/BaseModal.vue'

/**
 * The component teleports its whole body to `<body>`, so nothing it renders is reachable
 * through the wrapper — every query goes to the document.
 */
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const scrim = () => document.querySelector<HTMLElement>('.base-modal')
const appRoot = () => document.getElementById('__nuxt')

function mountModal(
  props: { title?: string; variant?: 'dialog' | 'drawer' } = {},
  slots: { default?: () => unknown; footer?: () => unknown } = {},
) {
  return mountSuspended(BaseModal, { props: { title: 'Edit record', ...props }, slots })
}

/** The listener lives on `document`, so the key has to be dispatched there. */
function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

describe('BaseModal', () => {
  beforeEach(() => {
    // The component marks this element `inert` and uses `?.`, so without one every inert
    // assertion would pass vacuously. Arranging the DOM the component documents it needs.
    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('structure', () => {
    it('teleports out of the wrapper and into the body', async () => {
      const wrapper = await mountModal()

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(dialog()).not.toBeNull()

      wrapper.unmount()
    })

    it('announces itself as a modal dialog named by its title', async () => {
      const wrapper = await mountModal()

      expect(dialog()?.getAttribute('aria-modal')).toBe('true')
      expect(dialog()?.getAttribute('aria-label')).toBe('Edit record')

      wrapper.unmount()
    })

    /** Focusable without joining the tab order, which is what lets focus move in on open. */
    it('makes the dialog container focusable but not tabbable', async () => {
      const wrapper = await mountModal()

      expect(dialog()?.getAttribute('tabindex')).toBe('-1')

      wrapper.unmount()
    })

    it('renders as a dialog by default and as a drawer on request', async () => {
      const asDialog = await mountModal()
      expect(scrim()?.classList.contains('base-modal--dialog')).toBe(true)
      asDialog.unmount()

      const asDrawer = await mountModal({ title: 'Filters', variant: 'drawer' })
      expect(scrim()?.classList.contains('base-modal--drawer')).toBe(true)
      asDrawer.unmount()
    })

    it('renders the default slot in the body', async () => {
      const wrapper = await mountModal({}, { default: () => 'Body content' })

      expect(document.querySelector('.base-modal__body')?.textContent).toContain('Body content')

      wrapper.unmount()
    })

    it('renders a footer only when one is passed', async () => {
      const without = await mountModal()
      expect(document.querySelector('.base-modal__footer')).toBeNull()
      without.unmount()

      const with_ = await mountModal({}, { footer: () => 'Save' })
      expect(document.querySelector('.base-modal__footer')?.textContent).toContain('Save')
      with_.unmount()
    })
  })

  describe('focus on open', () => {
    /**
     * The container rather than the first control, deliberately: that control is a destructive
     * Delete in one dialog and a text input in another, and landing on either is a decision the
     * dialog makes for itself through `autofocus`.
     */
    it('lands on the dialog container by default', async () => {
      const wrapper = await mountModal()

      expect(document.activeElement).toBe(dialog())

      wrapper.unmount()
    })

    it('lands on an autofocus descendant when the content names one', async () => {
      const wrapper = await mountModal(
        {},
        { default: () => h('input', { autofocus: true, 'data-testid': 'name' }) },
      )

      expect(document.activeElement).toBe(document.querySelector('[data-testid="name"]'))

      wrapper.unmount()
    })
  })

  /**
   * `aria-modal="true"` claims the rest of the page is unavailable, so the rest of the page has
   * to actually be unavailable — otherwise the attribute is a false signal and every control
   * behind the scrim stays focusable and in the accessibility tree.
   */
  describe('the inert guard', () => {
    it('takes the app root out of the tab order while open', async () => {
      expect(appRoot()?.hasAttribute('inert')).toBe(false)

      const wrapper = await mountModal()
      expect(appRoot()?.hasAttribute('inert')).toBe(true)

      wrapper.unmount()
    })

    it('gives it back on unmount', async () => {
      const wrapper = await mountModal()
      wrapper.unmount()

      expect(appRoot()?.hasAttribute('inert')).toBe(false)
    })
  })

  describe('focus on close', () => {
    /**
     * A dialog opened from a cell deep in a scrolled table is the case that makes this matter:
     * without it, closing drops the keyboard user at the top of the document.
     *
     * It also pins the ordering by outcome. The trigger is read *before* `inert` is applied (an
     * inert ancestor blurs whatever is inside it) and refocused *after* it is lifted (or the
     * element would still be unfocusable) — get either wrong and this fails.
     */
    it('returns focus to whatever opened it', async () => {
      const trigger = document.createElement('button')
      appRoot()?.appendChild(trigger)
      trigger.focus()
      expect(document.activeElement).toBe(trigger)

      const wrapper = await mountModal()
      expect(document.activeElement).not.toBe(trigger)

      wrapper.unmount()

      expect(document.activeElement).toBe(trigger)
    })

    /** The trigger can have gone with the dialog — a row's Edit button on a record just deleted. */
    it('does not try to focus a trigger that has since been removed', async () => {
      const trigger = document.createElement('button')
      appRoot()?.appendChild(trigger)
      trigger.focus()

      const wrapper = await mountModal()
      trigger.remove()

      expect(() => wrapper.unmount()).not.toThrow()
      expect(document.activeElement).not.toBe(trigger)
    })
  })

  describe('closing', () => {
    it('emits close on Escape', async () => {
      const wrapper = await mountModal()

      pressEscape()

      expect(wrapper.emitted('close')).toHaveLength(1)

      wrapper.unmount()
    })

    it('ignores other keys', async () => {
      const wrapper = await mountModal()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })

    it('emits close from the header button', async () => {
      const wrapper = await mountModal()

      document.querySelector<HTMLElement>('[aria-label="Close"]')?.click()

      expect(wrapper.emitted('close')).toHaveLength(1)

      wrapper.unmount()
    })

    it('emits close on a click on the scrim', async () => {
      const wrapper = await mountModal()

      scrim()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(wrapper.emitted('close')).toHaveLength(1)

      wrapper.unmount()
    })

    /** `@click.self` — a click that merely bubbles up through the scrim is not a click on it. */
    it('does not emit close for a click inside the dialog', async () => {
      const wrapper = await mountModal({}, { default: () => h('p', 'Some text') })

      document
        .querySelector('.base-modal__body p')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })
  })

  /**
   * What stops a dialog that has closed from eating the next one's Escape — the same reason
   * `usePopover` deliberately owns no keyboard listener at all.
   */
  it('releases the document listener on unmount', async () => {
    const wrapper = await mountModal()
    wrapper.unmount()

    pressEscape()

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
