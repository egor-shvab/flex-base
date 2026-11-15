import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import BaseMenu from '~/components/ui/BaseMenu/BaseMenu.vue'
import BaseMenuItem from '~/components/ui/BaseMenu/BaseMenuItem.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

const onRename = vi.fn()
const onRetry = vi.fn()

function menu(initialItemIndex = 0) {
  const Harness = defineComponent(
    () => () =>
      h(
        BaseMenu,
        { label: 'Actions', initialItemIndex },
        {
          trigger: ({
            triggerAttrs,
            setTriggerRef,
            toggle,
          }: {
            triggerAttrs: Record<string, unknown>
            setTriggerRef: (el: unknown) => void
            toggle: () => void
          }) => h('button', { ...triggerAttrs, ref: setTriggerRef, onClick: toggle }, 'Open'),
          default: () => [
            h(BaseMenuItem, { checked: false }, () => 'First'),
            h(BaseMenuItem, { onClick: onRename }, () => 'Rename'),
            h(BaseMenuItem, { keepOpen: true, onClick: onRetry }, () => 'Retry'),
          ],
        },
      ),
  )
  return mountTracked(Harness, { attachTo: document.body })
}

type TMenu = Awaited<ReturnType<typeof menu>>

const trigger = (wrapper: TMenu) => wrapper.get('button')
const panel = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = () => [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')]

async function open(wrapper: TMenu) {
  await trigger(wrapper).trigger('click')
  await nextTick()
  await nextTick()
}

describe('BaseMenu', () => {
  afterEach(() => {
    unmountAll()
    vi.clearAllMocks()
  })

  it('gives its trigger the menu-button attributes, closed until clicked', async () => {
    const wrapper = await menu()

    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('menu')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(panel()).toBeNull()
  })

  it('opens a named menu and focuses the requested item', async () => {
    const wrapper = await menu(1)

    await open(wrapper)

    expect(panel()?.getAttribute('aria-label')).toBe('Actions')
    expect(trigger(wrapper).attributes('aria-controls')).toBe(panel()?.id)
    expect(document.activeElement?.textContent?.trim()).toBe('Rename')
  })

  it('makes an item with `checked` a radio item', async () => {
    const wrapper = await menu()
    await open(wrapper)

    expect(items().map((item) => item.getAttribute('role'))).toEqual([
      'menuitemradio',
      'menuitem',
      'menuitem',
    ])
    expect(items()[0]?.getAttribute('aria-checked')).toBe('false')
  })

  it('closes on a chosen item, returning focus to the trigger', async () => {
    const wrapper = await menu()
    await open(wrapper)

    items()[1]?.click()
    await nextTick()

    expect(onRename).toHaveBeenCalledOnce()
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  it('stays open for a `keep-open` item', async () => {
    const wrapper = await menu()
    await open(wrapper)

    items()[2]?.click()
    await nextTick()

    expect(onRetry).toHaveBeenCalledOnce()
    expect(panel()).not.toBeNull()
  })
})
