import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { usePopover } from '~/composables/usePopover'
import { track, unmountAll } from '~~/test/mount'

/**
 * A host component, because `useId()` and `onBeforeUnmount` both need an instance. Render
 * functions rather than a template string: `vue` resolves to the runtime-only build here, so
 * there is no in-browser compiler to hand a template to.
 *
 * The panel is rendered as a **sibling** of the container, not a child — that is what a
 * `<Teleport to="body">` leaves behind, and the case the composable's two-ref `contains` exists
 * for. A single trigger-subtree check would call the panel itself "outside".
 *
 * The composable's return is captured out of `setup` rather than read back off `wrapper.vm`,
 * which unwraps refs and would make `open` a boolean where the declared type says `Ref`.
 */
function setup() {
  let popover!: ReturnType<typeof usePopover>

  const Host = defineComponent({
    setup() {
      popover = usePopover()

      return () =>
        h('div', [
          h('div', { ref: popover.containerRef, 'data-testid': 'container' }, [
            h('button', { ref: popover.triggerRef, 'data-testid': 'trigger' }, 'Open'),
            h('button', { 'data-testid': 'clear' }, 'Clear'),
          ]),
          h('div', { ref: popover.panelRef, 'data-testid': 'panel' }, [
            h('button', { 'data-testid': 'option' }, 'An option'),
          ]),
          h('button', { 'data-testid': 'outside' }, 'Elsewhere'),
        ])
    },
  })

  // `mount` runs setup synchronously, so `popover` is assigned by the time this returns
  const wrapper = track(mount(Host, { attachTo: document.body }))

  const at = (testId: string) => wrapper.get(`[data-testid="${testId}"]`).element as HTMLElement

  return { wrapper, popover, at }
}

/** The composable listens on `document`, so the event has to reach it by bubbling. */
function pointerDownOn(element: HTMLElement) {
  element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

describe('usePopover', () => {
  afterEach(unmountAll)

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('starts closed and hands out a stable panel id', () => {
    const { popover } = setup()

    expect(popover.open.value).toBe(false)
    expect(popover.panelId).toBeTruthy()
  })

  it('opens with show and flips with toggle', async () => {
    const { popover } = setup()

    popover.show()
    expect(popover.open.value).toBe(true)

    popover.toggle()
    expect(popover.open.value).toBe(false)

    popover.toggle()
    expect(popover.open.value).toBe(true)
  })

  it('closes on a pointerdown outside', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()

    pointerDownOn(at('outside'))

    expect(popover.open.value).toBe(false)
  })

  /**
   * The boundary is the trigger's whole *area*, not just its button: a control may put a clear
   * button beside its trigger, and a pointerdown there must not close the popover and swallow
   * the click.
   */
  it('treats the whole container as inside, not just the trigger', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()

    pointerDownOn(at('clear'))

    expect(popover.open.value).toBe(true)
  })

  it('treats a teleported panel as inside even though it is outside the trigger subtree', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()

    pointerDownOn(at('option'))

    expect(popover.open.value).toBe(true)
  })

  it('leaves focus where the pointer put it when closing on an outside click', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()

    at('outside').focus()
    pointerDownOn(at('outside'))

    expect(popover.open.value).toBe(false)
    // No focus restore here — the pointer has already chosen where focus should go
    expect(document.activeElement).toBe(at('outside'))
  })

  it('hands focus back to the trigger on dismiss', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()
    at('option').focus()

    popover.dismiss()

    expect(popover.open.value).toBe(false)
    expect(document.activeElement).toBe(at('trigger'))
  })

  it('does not try to focus a trigger that has gone with the popover', async () => {
    const { popover, at } = setup()

    popover.show()
    await nextTick()

    // A drawer closed while its panel was open — the trigger is detached but the ref survives
    const trigger = at('trigger')
    trigger.remove()

    expect(() => popover.dismiss()).not.toThrow()
    expect(popover.open.value).toBe(false)
    expect(document.activeElement).not.toBe(trigger)
  })

  it('binds the document listener only while open', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')

    const { popover } = setup()

    popover.show()
    await nextTick()
    expect(add).toHaveBeenCalledWith('pointerdown', expect.any(Function))

    popover.dismiss()
    await nextTick()
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  it('releases the document listener on unmount', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { wrapper, popover } = setup()

    popover.show()
    await nextTick()
    remove.mockClear()

    wrapper.unmount()

    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  /**
   * Load-bearing negative. `BaseModal` owns the document-level Escape listener, and two of them
   * cannot be ordered reliably — one keypress would close both the popover and the dialog around
   * it. Escape stays a template handler on the panel; growing one here would be a regression.
   */
  it('registers no keyboard listener of its own', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const { popover } = setup()

    popover.show()
    await nextTick()

    const events = add.mock.calls.map(([event]) => event)
    expect(events).not.toContain('keydown')
    expect(events).not.toContain('keyup')
  })
})
