import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import RecordRowMenu from '~/components/features/records/RecordRowMenu.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

function menu(props: { canEdit?: boolean; canDelete?: boolean } = {}) {
  return mountTracked(RecordRowMenu, {
    attachTo: document.body,
    props: {
      viewTo: { query: { detail: '4.7' } },
      canEdit: props.canEdit ?? true,
      canDelete: props.canDelete ?? true,
    },
  })
}

type TMenu = Awaited<ReturnType<typeof menu>>

const trigger = (wrapper: TMenu) => wrapper.get('button[aria-label="More actions"]')
const panel = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
const itemNames = () => items().map((menuItem) => menuItem.textContent?.trim())
/** Styles are off under test, so the items a breakpoint hides above compact are all present. */
const item = (name = 'Delete record') =>
  items().find((menuItem) => menuItem.textContent?.trim() === name)

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

  it('opens a menu holding View, Edit and Delete, with focus on the first', async () => {
    const wrapper = await menu()

    await openMenu(wrapper)

    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
    expect(trigger(wrapper).attributes('aria-controls')).toBe(panel()!.id)
    expect(itemNames()).toEqual(['View record', 'Edit record', 'Delete record'])
    expect(document.activeElement).toBe(items()[0])
  })

  it('leaves out what the caller may not do, and always offers View', async () => {
    const wrapper = await menu({ canEdit: false, canDelete: false })

    await openMenu(wrapper)

    expect(itemNames()).toEqual(['View record'])
  })

  it('marks View and Edit as the compact copies of the row’s buttons', async () => {
    const wrapper = await menu()

    await openMenu(wrapper)

    expect(item('View record')!.classList).toContain('record-row-menu__compact-item')
    expect(item('Edit record')!.classList).toContain('record-row-menu__compact-item')
    expect(item('Delete record')!.classList).not.toContain('record-row-menu__compact-item')
    expect(item('View record')!.getAttribute('href')).toContain('detail=4.7')
  })

  it('shows its trigger only below compact when there is nothing to delete', async () => {
    const withDelete = await menu()
    const withoutDelete = await menu({ canDelete: false })

    expect(withDelete.classes()).not.toContain('record-row-menu--compact-only')
    expect(withoutDelete.classes()).toContain('record-row-menu--compact-only')
  })

  it('emits edit on choosing Edit', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)

    item('Edit record')!.click()
    await nextTick()

    expect(wrapper.emitted('edit')).toEqual([[]])
  })

  it('emits delete on choosing, closing and handing focus back', async () => {
    const wrapper = await menu()
    await openMenu(wrapper)

    item()!.click()
    await nextTick()

    expect(wrapper.emitted('delete')).toEqual([[]])
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

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
