import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import BaseModal from '~/components/common/BaseModal.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const scrim = () => document.querySelector<HTMLElement>('.base-modal')
const appRoot = () => document.getElementById('__nuxt')

function mountModal(
  props: {
    title?: string
    variant?: 'dialog' | 'drawer'
    size?: 'sm' | 'md' | 'lg'
    subtitle?: string
  } = {},
  slots: { default?: () => unknown; footer?: () => unknown; leading?: () => unknown } = {},
) {
  return mountTracked(BaseModal, { props: { title: 'Edit record', ...props }, slots })
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

describe('BaseModal', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    // The component reaches this element through `?.`, so without it inert assertions pass
    // vacuously
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
    })

    it('announces itself as a modal dialog named by its title', async () => {
      await mountModal()

      expect(dialog()?.getAttribute('aria-modal')).toBe('true')
      expect(dialog()?.getAttribute('aria-label')).toBe('Edit record')
    })

    it('makes the dialog container focusable but not tabbable', async () => {
      await mountModal()

      expect(dialog()?.getAttribute('tabindex')).toBe('-1')
    })

    it('renders as a dialog by default and as a drawer on request', async () => {
      const asDialog = await mountModal()
      expect(scrim()?.classList.contains('base-modal--dialog')).toBe(true)
      asDialog.unmount()

      await mountModal({ title: 'Filters', variant: 'drawer' })
      expect(scrim()?.classList.contains('base-modal--drawer')).toBe(true)
    })

    it('is the medium width by default and takes the size it is given', async () => {
      const medium = await mountModal()
      expect(scrim()?.classList.contains('base-modal--md')).toBe(true)
      medium.unmount()

      await mountModal({ size: 'sm' })
      expect(scrim()?.classList.contains('base-modal--sm')).toBe(true)
      expect(scrim()?.classList.contains('base-modal--md')).toBe(false)
    })

    it('renders a subtitle under the title only when given', async () => {
      const without = await mountModal()
      expect(document.querySelector('.base-modal__subtitle')).toBeNull()
      without.unmount()

      await mountModal({ subtitle: 'Deals · #1042' })
      expect(document.querySelector('.base-modal__subtitle')?.textContent).toBe('Deals · #1042')
    })

    it('keeps the dialog named by its title when a subtitle is shown', async () => {
      await mountModal({ subtitle: 'Deals · #1042' })

      expect(dialog()?.getAttribute('aria-label')).toBe('Edit record')
    })

    it('renders the default slot in the body', async () => {
      await mountModal({}, { default: () => 'Body content' })

      expect(document.querySelector('.base-modal__body')?.textContent).toContain('Body content')
    })

    it('renders a footer only when one is passed', async () => {
      const without = await mountModal()
      expect(document.querySelector('.base-modal__footer')).toBeNull()
      without.unmount()

      await mountModal({}, { footer: () => 'Save' })
      expect(document.querySelector('.base-modal__footer')?.textContent).toContain('Save')
    })

    it('renders a leading slot in the header, before the title', async () => {
      await mountModal({}, { leading: () => h('span', { class: 'glyph' }, '!') })

      const header = document.querySelector('.base-modal__header')
      expect(header?.firstElementChild?.classList.contains('glyph')).toBe(true)
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
        'Edit record',
      )
    })
  })

  describe('focus on open', () => {
    it('lands on the dialog container by default', async () => {
      await mountModal()

      expect(document.activeElement).toBe(dialog())
    })

    it('lands on an autofocus descendant when the content names one', async () => {
      await mountModal(
        {},
        { default: () => h('input', { autofocus: true, 'data-testid': 'name' }) },
      )

      expect(document.activeElement).toBe(document.querySelector('[data-testid="name"]'))
    })
  })

  describe('the inert guard', () => {
    it('takes the app root out of the tab order while open', async () => {
      expect(appRoot()?.hasAttribute('inert')).toBe(false)

      await mountModal()
      expect(appRoot()?.hasAttribute('inert')).toBe(true)
    })

    it('gives it back on unmount', async () => {
      const wrapper = await mountModal()
      wrapper.unmount()

      expect(appRoot()?.hasAttribute('inert')).toBe(false)
    })
  })

  describe('focus on close', () => {
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
    })

    it('ignores other keys', async () => {
      const wrapper = await mountModal()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('emits close from the header button', async () => {
      const wrapper = await mountModal()

      document.querySelector<HTMLElement>('[aria-label="Close"]')?.click()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emits close on a click on the scrim', async () => {
      const wrapper = await mountModal()

      scrim()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not emit close for a click inside the dialog', async () => {
      const wrapper = await mountModal({}, { default: () => h('p', 'Some text') })

      document
        .querySelector('.base-modal__body p')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })

  it('releases the document listener on unmount', async () => {
    const wrapper = await mountModal()
    wrapper.unmount()

    pressEscape()

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
