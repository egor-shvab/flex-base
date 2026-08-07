import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseButton from '~/components/common/BaseButton.vue'

describe('BaseButton', () => {
  describe('what it renders as', () => {
    it('is a button of type button by default', async () => {
      const wrapper = await mountSuspended(BaseButton, { slots: { default: () => 'Save' } })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.attributes('type')).toBe('button')
      expect(wrapper.text()).toContain('Save')
    })

    it('can be a submit button', async () => {
      const wrapper = await mountSuspended(BaseButton, { props: { type: 'submit' } })

      expect(wrapper.attributes('type')).toBe('submit')
    })

    /**
     * A real `<a href>`, not a button with a click handler — so middle-click, "copy link
     * address" and the SSR'd markup all work.
     */
    it('is an anchor with an href when given a target', async () => {
      const wrapper = await mountSuspended(BaseButton, { props: { to: '/tables/tbl_1' } })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toBe('/tables/tbl_1')
    })

    it('accepts a query-only target that keeps the current route', async () => {
      const wrapper = await mountSuspended(BaseButton, {
        props: { to: { query: { detail: 'tbl_1.rec_1' } } },
      })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toContain('detail=tbl_1.rec_1')
    })

    /**
     * `disabled` wins over `to`, because a disabled link is not a link: an anchor has no
     * `disabled`, and faking it rebuilds by hand what the native attribute already does.
     */
    it('falls back to a disabled button when a link is disabled', async () => {
      const wrapper = await mountSuspended(BaseButton, {
        props: { to: '/tables/tbl_1', disabled: true },
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.attributes('href')).toBeUndefined()
    })

    it('does not put a type attribute on an anchor', async () => {
      const wrapper = await mountSuspended(BaseButton, { props: { to: '/somewhere' } })

      // `type` on an anchor is a MIME hint, not a button role — the two modes bind disjoint sets
      expect(wrapper.attributes('type')).toBeUndefined()
    })
  })

  describe('variants and tone', () => {
    it('carries the primary variant class by default', async () => {
      const wrapper = await mountSuspended(BaseButton)

      expect(wrapper.classes()).toContain('base-button')
      expect(wrapper.classes()).toContain('base-button--primary')
    })

    it.each(['primary', 'secondary', 'danger', 'icon', 'ghost', 'link'] as const)(
      'emits the %s variant class',
      async (variant) => {
        const wrapper = await mountSuspended(BaseButton, { props: { variant } })

        expect(wrapper.classes()).toContain(`base-button--${variant}`)
      },
    )

    it('adds the danger tone alongside the variant rather than replacing it', async () => {
      const wrapper = await mountSuspended(BaseButton, {
        props: { variant: 'icon', tone: 'danger' },
      })

      expect(wrapper.classes()).toContain('base-button--icon')
      expect(wrapper.classes()).toContain('base-button--danger-tone')
    })

    it('leaves the tone class off by default', async () => {
      const wrapper = await mountSuspended(BaseButton, { props: { variant: 'icon' } })

      expect(wrapper.classes()).not.toContain('base-button--danger-tone')
    })
  })

  describe('accessible naming', () => {
    /** Required for icon-only buttons, which have no text for a screen reader to read. */
    it('sets both aria-label and title from label', async () => {
      const wrapper = await mountSuspended(BaseButton, {
        props: { variant: 'icon', icon: 'mdi:trash-can-outline', label: 'Delete this table' },
      })

      expect(wrapper.attributes('aria-label')).toBe('Delete this table')
      expect(wrapper.attributes('title')).toBe('Delete this table')
    })

    it('renders the icon and hides it from assistive tech', async () => {
      const wrapper = await mountSuspended(BaseButton, {
        props: { icon: 'mdi:plus', label: 'Add' },
      })

      const icon = wrapper.find('.base-button__icon')
      expect(icon.exists()).toBe(true)
      expect(icon.attributes('aria-hidden')).toBe('true')
    })

    it('renders no icon element when none is named', async () => {
      const wrapper = await mountSuspended(BaseButton, { slots: { default: () => 'Save' } })

      expect(wrapper.find('.base-button__icon').exists()).toBe(false)
    })
  })

  describe('interaction', () => {
    // Nothing is forwarded by hand: a listener reaches the root element by attribute
    // fallthrough, which is also what makes `NuxtLink`'s own props work in link mode
    it('forwards clicks by attribute fallthrough', async () => {
      const onClick = vi.fn()
      const wrapper = await mountSuspended(BaseButton, { attrs: { onClick } })

      await wrapper.get('button').trigger('click')

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not fire when disabled', async () => {
      const onClick = vi.fn()
      const wrapper = await mountSuspended(BaseButton, {
        props: { disabled: true },
        attrs: { onClick },
      })

      await wrapper.get('button').trigger('click')

      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
