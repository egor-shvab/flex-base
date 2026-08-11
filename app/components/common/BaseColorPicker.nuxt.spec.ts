import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { BADGE_COLORS } from '#shared/constants/color'
import type { TBadgeColor } from '#shared/types/color'
import BaseColorPicker from '~/components/common/BaseColorPicker.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

function mountPicker(props: { modelValue?: TBadgeColor; disabled?: boolean } = {}) {
  return mountTracked(BaseColorPicker, {
    props: { label: 'Colour for choice 1', modelValue: 'blue' as TBadgeColor, ...props },
    // Attached, or nothing it renders is `isConnected` and every focus assertion is vacuous —
    // the roving tabindex and the focus restore are half of what this control is
    attachTo: document.body,
  })
}

/** Opens the panel and settles both ticks: focus lands on one, the measurement on the next. */
async function opened(props: { modelValue?: TBadgeColor } = {}) {
  const wrapper = await mountPicker(props)
  await wrapper.get('button').trigger('click')
  await nextTick()
  await nextTick()

  return wrapper
}

describe('BaseColorPicker', () => {
  afterEach(unmountAll)

  describe('the trigger', () => {
    /** A swatch has no text of its own, so the colour has to be in the name. */
    it('names the colour it is for and what that colour currently is', async () => {
      const wrapper = await mountPicker({ modelValue: 'teal' })

      expect(wrapper.get('button').attributes('aria-label')).toBe('Colour for choice 1: Teal')
    })

    it('reports the panel as closed until it is opened', async () => {
      const wrapper = await mountPicker()
      expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')

      await wrapper.get('button').trigger('click')

      expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    })

    it('points at the panel it controls', async () => {
      const wrapper = await opened()
      const panelId = wrapper.get('button').attributes('aria-controls')

      expect(wrapper.get('[role="radiogroup"]').attributes('id')).toBe(panelId)
    })
  })

  describe('the panel', () => {
    it('offers the whole palette as a radio group, with the current colour checked', async () => {
      const wrapper = await opened({ modelValue: 'green' })
      const swatches = wrapper.findAll('[role="radio"]')

      expect(swatches).toHaveLength(BADGE_COLORS.length)
      expect(swatches.map((swatch) => swatch.attributes('aria-checked'))).toEqual(
        BADGE_COLORS.map((color) => String(color === 'green')),
      )
    })

    /**
     * The change this spec exists for: the panel used to be `position: absolute` with a `top` in
     * CSS, so it always opened downward and could run off a short viewport. It is now placed by
     * `useAnchoredPosition`, which writes viewport coordinates — the arithmetic, including the
     * flip, is pinned in that composable's own spec, so what matters here is only that the
     * picker is wired to it.
     */
    it('is positioned by the composable rather than by CSS', async () => {
      const panel = (await opened()).get<HTMLElement>('[role="radiogroup"]')

      expect(panel.element.style.top).not.toBe('')
      expect(panel.element.style.left).not.toBe('')
    })

    /**
     * Stated rather than left at the composable's 280 default: this panel is a fixed grid of two
     * `--control-height` rows, and a 280 cap would fail the "does it fit below?" test in rooms it
     * comfortably fits, flipping it for no reason.
     */
    it('caps itself at its own height, not at the composable’s default', async () => {
      const panel = (await opened()).get<HTMLElement>('[role="radiogroup"]')

      expect(panel.element.style.maxHeight).toBe('120px')
    })

    it('takes it away again on close', async () => {
      const wrapper = await opened()

      await wrapper.get('button').trigger('click')

      expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
    })
  })

  describe('choosing', () => {
    it('emits the chosen colour and closes', async () => {
      const wrapper = await opened()

      await wrapper.findAll('[role="radio"]')[1]?.trigger('click')

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([BADGE_COLORS[1]])
      expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
    })

    /** Focus goes back to the trigger, or a keyboard user is left at the top of the document. */
    it('hands focus back to the trigger', async () => {
      const wrapper = await opened()

      await wrapper.findAll('[role="radio"]')[1]?.trigger('click')

      expect(document.activeElement).toBe(wrapper.get('button').element)
    })
  })

  describe('the keyboard', () => {
    /** Opening onto the selected swatch is what gives the roving tabindex somewhere to rove from. */
    it('focuses the selected swatch on open, and only that one is tabbable', async () => {
      const wrapper = await opened({ modelValue: 'green' })
      const swatches = wrapper.findAll('[role="radio"]')
      const selected = BADGE_COLORS.indexOf('green')

      expect(document.activeElement).toBe(swatches[selected]?.element)
      expect(swatches.map((swatch) => swatch.attributes('tabindex'))).toEqual(
        BADGE_COLORS.map((color) => (color === 'green' ? '0' : '-1')),
      )
    })

    /** Arrow keys move the selection with focus, the way a native radio group does. */
    it.each([
      ['ArrowRight', 'indigo'],
      ['ArrowDown', 'indigo'],
      ['ArrowLeft', 'teal'],
      ['ArrowUp', 'teal'],
    ])('moves the selection on %s', async (key, expected) => {
      const wrapper = await opened({ modelValue: 'blue' })

      await wrapper.get('[role="radiogroup"]').trigger('keydown', { key })

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([expected])
    })

    it('wraps around at both ends', async () => {
      const first = await opened({ modelValue: BADGE_COLORS[0] })
      await first.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowLeft' })
      expect(first.emitted('update:modelValue')?.[0]).toEqual([BADGE_COLORS.at(-1)])

      const last = await opened({ modelValue: BADGE_COLORS.at(-1) })
      await last.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })
      expect(last.emitted('update:modelValue')?.[0]).toEqual([BADGE_COLORS[0]])
    })

    it.each([
      ['Home', BADGE_COLORS[0]],
      ['End', BADGE_COLORS.at(-1)],
    ])('jumps to an end on %s', async (key, expected) => {
      const wrapper = await opened({ modelValue: 'blue' })

      await wrapper.get('[role="radiogroup"]').trigger('keydown', { key })

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([expected])
    })

    /**
     * Escape is handled on the panel with `.stop` because this opens inside `BaseModal`, whose
     * own Escape listener is on `document` — one keypress must not close both.
     */
    it('closes on Escape without letting the key reach the document', async () => {
      const wrapper = await opened()
      let reachedDocument = false
      const listener = () => (reachedDocument = true)
      document.addEventListener('keydown', listener)

      await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'Escape' })
      document.removeEventListener('keydown', listener)

      expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
      expect(reachedDocument).toBe(false)
      expect(document.activeElement).toBe(wrapper.get('button').element)
    })
  })

  it('opens nothing while disabled', async () => {
    const wrapper = await mountPicker({ disabled: true })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})
