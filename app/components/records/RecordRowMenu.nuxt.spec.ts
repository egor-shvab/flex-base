import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import RecordRowMenu from '~/components/records/RecordRowMenu.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

function menu() {
  return mountTracked(RecordRowMenu, { attachTo: document.body })
}

type TMenu = Awaited<ReturnType<typeof menu>>

const trigger = (wrapper: TMenu) => wrapper.get('button[aria-label="More actions"]')
// Teleported, so it is looked up through the document rather than the wrapper
const panel = () => document.querySelector<HTMLElement>('[role="menu"]')
const item = () => document.querySelector<HTMLElement>('[role="menuitem"]')

async function openMenu(wrapper: TMenu) {
  await trigger(wrapper).trigger('click')
  await nextTick()
}

describe('RecordRowMenu', () => {
  afterEach(unmountAll)

  it('names its trigger and says it opens a menu', async () => {
    const wrapper = await menu()

    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('menu')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
  })

  it('opens a menu holding Delete, with focus on it', async () => {
    const wrapper = await menu()

    await openMenu(wrapper)

    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
    expect(trigger(wrapper).attributes('aria-controls')).toBe(panel()!.id)
    expect(item()!.textContent!.trim()).toBe('Delete record')
    expect(document.activeElement).toBe(item())
  })

  /** Focus is back on the trigger first, so the confirm dialog returns it there on close. */
  it('emits delete on choosing, closing and handing focus back', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)

    item()!.click()
    await nextTick()

    expect(wrapper.emitted('delete')).toEqual([[]])
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  /** One keypress closes one thing: a dialog or the sidebar around it must not hear it. */
  it('closes on Escape without letting the key reach the document', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)
    const heard = vi.fn()
    document.addEventListener('keydown', heard)

    item()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    document.removeEventListener('keydown', heard)

    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
    expect(heard).not.toHaveBeenCalled()
  })

  /** Tab's own default then carries focus on from the trigger, as the menu-button pattern says. */
  it('closes on Tab, handing focus back to the trigger', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)

    item()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await nextTick()

    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  it('closes on a pointerdown outside', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()

    expect(panel()).toBeNull()
  })
})
