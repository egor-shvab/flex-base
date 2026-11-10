import { afterEach, describe, expect, it, vi } from 'vitest'

import BaseButton from '~/components/common/BaseButton.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

describe('BaseButton', () => {
  afterEach(unmountAll)

  describe('what it renders as', () => {
    it('is a button of type button by default', async () => {
      const wrapper = await mountTracked(BaseButton, { slots: { default: () => 'Save' } })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.attributes('type')).toBe('button')
      expect(wrapper.text()).toContain('Save')
    })

    it('can be a submit button', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { type: 'submit' } })

      expect(wrapper.attributes('type')).toBe('submit')
    })

    it('is an anchor with an href when given a target', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { to: '/tables/tbl_1' } })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toBe('/tables/tbl_1')
    })

    it('accepts a query-only target that keeps the current route', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { to: { query: { detail: 'tbl_1.rec_1' } } },
      })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toContain('detail=tbl_1.rec_1')
    })

    it('falls back to a disabled button when a link is disabled', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { to: '/tables/tbl_1', disabled: true },
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.attributes('href')).toBeUndefined()
    })

    it('does not put a type attribute on an anchor', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { to: '/somewhere' } })

      expect(wrapper.attributes('type')).toBeUndefined()
    })
  })

  describe('variants and tone', () => {
    it('carries the primary variant class by default', async () => {
      const wrapper = await mountTracked(BaseButton)

      expect(wrapper.classes()).toContain('base-button')
      expect(wrapper.classes()).toContain('base-button--primary')
    })

    it.each(['primary', 'secondary', 'danger', 'icon', 'ghost', 'link'] as const)(
      'emits the %s variant class',
      async (variant) => {
        const wrapper = await mountTracked(BaseButton, { props: { variant } })

        expect(wrapper.classes()).toContain(`base-button--${variant}`)
      },
    )

    it('adds the danger tone alongside the variant rather than replacing it', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { variant: 'icon', tone: 'danger' },
      })

      expect(wrapper.classes()).toContain('base-button--icon')
      expect(wrapper.classes()).toContain('base-button--danger-tone')
    })

    it('leaves the tone class off by default', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { variant: 'icon' } })

      expect(wrapper.classes()).not.toContain('base-button--danger-tone')
    })

    it('adds the small size alongside the variant rather than replacing it', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { variant: 'icon', size: 'sm' },
      })

      expect(wrapper.classes()).toContain('base-button--icon')
      expect(wrapper.classes()).toContain('base-button--sm')
    })

    it('leaves the size class off at the default size', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { variant: 'icon' } })

      expect(wrapper.classes()).not.toContain('base-button--sm')
    })
  })

  describe('accessible naming', () => {
    it('sets both aria-label and title from label', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: {
          variant: 'icon',
          prependIcon: 'material-symbols:delete-outline-rounded',
          label: 'Delete this table',
        },
      })

      expect(wrapper.attributes('aria-label')).toBe('Delete this table')
      expect(wrapper.attributes('title')).toBe('Delete this table')
    })

    it.each(['prependIcon', 'appendIcon'] as const)(
      'renders the %s and hides it from assistive tech',
      async (side) => {
        const wrapper = await mountTracked(BaseButton, {
          props: { [side]: 'material-symbols:add-rounded', label: 'Add' },
        })

        const icon = wrapper.find('.base-button__icon')
        expect(icon.exists()).toBe(true)
        expect(icon.attributes('aria-hidden')).toBe('true')
      },
    )

    it('renders no icon element when none is named', async () => {
      const wrapper = await mountTracked(BaseButton, { slots: { default: () => 'Save' } })

      expect(wrapper.find('.base-button__icon').exists()).toBe(false)
    })

    it('puts the prepended icon before the label and the appended one after', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: {
          prependIcon: 'material-symbols:chevron-left-rounded',
          appendIcon: 'material-symbols:chevron-right-rounded',
        },
        slots: { default: () => 'Next' },
      })

      const icons = wrapper.findAll('.base-button__icon')
      expect(icons).toHaveLength(2)
      expect(icons[0]?.element).toBe(wrapper.element.firstElementChild)
      expect(icons[1]?.element).toBe(wrapper.element.lastElementChild)
      expect(wrapper.text()).toBe('Next')
    })
  })

  describe('selected and loading', () => {
    it('adds the selected state alongside the variant', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { variant: 'ghost', selected: true },
      })

      expect(wrapper.classes()).toEqual(
        expect.arrayContaining(['base-button--ghost', 'base-button--selected']),
      )
      expect(wrapper.attributes('aria-pressed')).toBeUndefined()
    })

    it('is busy and inert while loading, and keeps its label', async () => {
      const onClick = vi.fn()
      const wrapper = await mountTracked(BaseButton, {
        props: { loading: true },
        attrs: { onClick },
        slots: { default: () => 'Saving…' },
      })

      expect(wrapper.attributes('aria-busy')).toBe('true')
      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toBe('Saving…')

      await wrapper.trigger('click')
      expect(onClick).not.toHaveBeenCalled()
    })

    it('draws the spinner in place of the leading icon', async () => {
      const wrapper = await mountTracked(BaseButton, {
        props: { loading: true, prependIcon: 'material-symbols:add-rounded' },
      })

      expect(wrapper.find('.base-button__spinner').attributes('aria-hidden')).toBe('true')
      expect(wrapper.find('.base-button__icon').exists()).toBe(false)
    })

    it('sets no busy state when idle', async () => {
      const wrapper = await mountTracked(BaseButton)

      expect(wrapper.attributes('aria-busy')).toBeUndefined()
      expect(wrapper.find('.base-button__spinner').exists()).toBe(false)
    })

    it('falls back to a button while a link is loading', async () => {
      const wrapper = await mountTracked(BaseButton, { props: { to: '/tables/1', loading: true } })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.attributes('href')).toBeUndefined()
    })
  })

  describe('interaction', () => {
    it('forwards clicks by attribute fallthrough', async () => {
      const onClick = vi.fn()
      const wrapper = await mountTracked(BaseButton, { attrs: { onClick } })

      await wrapper.get('button').trigger('click')

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not fire when disabled', async () => {
      const onClick = vi.fn()
      const wrapper = await mountTracked(BaseButton, {
        props: { disabled: true },
        attrs: { onClick },
      })

      await wrapper.get('button').trigger('click')

      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
