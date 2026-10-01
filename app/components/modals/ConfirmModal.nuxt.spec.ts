import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ConfirmModal from '~/components/modals/ConfirmModal.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The universal destructive dialog. Built on `BaseModal`, so its body is teleported and every
 * query goes to the document. What is worth pinning is the error surface and the pending state
 * that must not let a second request start.
 */
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const alert = () => document.querySelector<HTMLElement>('[role="alert"]')

const button = (name: string) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find((element) =>
    element.textContent?.trim().startsWith(name),
  )

function mountConfirm(props: Record<string, unknown> = {}) {
  return mountTracked(ConfirmModal, {
    props: { title: 'Delete table', ...props },
    slots: { default: () => 'Delete Deals?' },
  })
}

describe('ConfirmModal', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    // `BaseModal` marks this element inert through `?.`, so an absent one passes vacuously
    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('says nothing where the error would go until there is one', async () => {
    await mountConfirm()

    expect(alert()).toBeNull()
  })

  /**
   * The message a refused delete carries. `role="alert"` because it appears after an action the
   * user took, in a dialog they are already looking at, with nothing else changing on screen.
   */
  it('renders the reason a refusal gave, as an alert', async () => {
    await mountConfirm({ error: 'Remove the field “owner” first' })

    expect(alert()?.textContent).toContain('Remove the field “owner” first')
  })

  /** The dialog stays open behind the message — that is what makes it readable at all. */
  it('keeps both controls reachable so the refusal can be read and dismissed', async () => {
    await mountConfirm({ error: 'Nope' })

    expect(button('Cancel')).toBeDefined()
    expect(button('Confirm')).toBeDefined()
    expect(dialog()).not.toBeNull()
  })

  /** `loading` rather than a relabel, so the button keeps its width and still says it is busy. */
  it('disables both controls while a request is in flight', async () => {
    await mountConfirm({ pending: true, confirmLabel: 'Delete', danger: true })

    expect(button('Cancel')?.disabled).toBe(true)
    expect(button('Delete')?.disabled).toBe(true)
    expect(button('Delete')?.getAttribute('aria-busy')).toBe('true')
  })

  /** A stray Enter on open must keep the data, so focus starts on the way out. */
  it('puts focus on Cancel when it opens', async () => {
    await mountConfirm({ confirmLabel: 'Delete', danger: true })

    expect(document.activeElement).toBe(button('Cancel'))
  })

  it('shows the warning tile beside the title only for a destructive confirmation', async () => {
    const tile = () => dialog()?.querySelector('.base-modal__header .confirm-modal__warning')

    await mountConfirm({ danger: true })
    expect(tile()).not.toBeNull()

    unmountAll()
    await mountConfirm()
    expect(tile()).toBeNull()
  })

  it('emits confirm and close rather than acting itself', async () => {
    const wrapper = await mountConfirm()

    button('Confirm')?.click()
    button('Cancel')?.click()

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('takes the caller’s label for the destructive action', async () => {
    await mountConfirm({ confirmLabel: 'Delete', danger: true })

    expect(button('Delete')).toBeDefined()
  })
})
