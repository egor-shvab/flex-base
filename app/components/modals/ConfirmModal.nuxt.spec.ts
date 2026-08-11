import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ConfirmModal from '~/components/modals/ConfirmModal.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The universal destructive dialog. It is built on `BaseModal`, which teleports its body to
 * `<body>` — so nothing here is reachable through the wrapper and every query goes to the
 * document, exactly as `BaseModal.nuxt.spec.ts` does.
 *
 * What is worth pinning is the half that only appeared once a refused delete had something to
 * say: the error surface, and the pending state that must not let a second request start.
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
    // `BaseModal` marks this element inert while it is open and uses `?.`, so an absent one
    // would make that guard pass vacuously
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
   * The message a refused delete carries — a table still pointed at by a relation names the
   * field to remove first. `role="alert"` because it appears in a dialog the user is already
   * looking at, after an action they took, and nothing else on screen changes to announce it.
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

  it('disables both controls while a request is in flight', async () => {
    await mountConfirm({ pending: true, confirmLabel: 'Deleting…' })

    expect(button('Cancel')?.disabled).toBe(true)
    expect(button('Deleting')?.disabled).toBe(true)
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
