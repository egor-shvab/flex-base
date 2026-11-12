import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import WorkspaceSwitcher from '~/components/app/WorkspaceSwitcher.vue'
import { useWorkspacesStore } from '~/stores/workspaces'
import { mountTracked, unmountAll } from '~~/test/mount'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'

mockNuxtImport('useRoute', () => () => ({ params: { workspaceAddress: WS }, query: {} }))

function buildMembership(
  publicId: string,
  name: string,
  overrides: Partial<IWorkspaceMembership> = {},
): IWorkspaceMembership {
  return {
    memberId: `mem_${publicId}`,
    isOwner: false,
    permissions: [],
    role: { id: 'rol_1', name: 'Editor' },
    workspace: { id: `wsp_${publicId}`, publicId, name, createdAt: '2026-01-01T00:00:00.000Z' },
    ...overrides,
  }
}

registerEndpoint('/api/workspaces', {
  method: 'GET',
  handler: () => ({
    memberships: [
      buildMembership(OTHER_WS, 'Side project', { isOwner: true }),
      buildMembership(WS, 'Acme Sales'),
    ],
    lastWorkspaceAddress: WS,
  }),
})

const trigger = () => document.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!
const panel = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]'),
]

function press(key: string) {
  ;(document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  return nextTick()
}

async function mountSwitcher() {
  const wrapper = await mountTracked(WorkspaceSwitcher, { attachTo: document.body })
  await useWorkspacesStore().fetchWorkspaces()
  await nextTick()
  return wrapper
}

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
  })

  afterEach(unmountAll)

  it('names the current workspace and the caller’s place in it', async () => {
    await mountSwitcher()

    expect(trigger().textContent).toContain('Acme Sales')
    expect(trigger().textContent).toContain('Editor')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens from the keyboard onto the current workspace, marked as checked', async () => {
    await mountSwitcher()
    trigger().focus()

    await press('ArrowDown')
    await nextTick()

    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('aria-controls')).toBe(panel()!.id)
    expect(document.activeElement?.textContent).toContain('Acme Sales')
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true')
  })

  it('lists every workspace, the owner’s as Owner, then the way to create one', async () => {
    await mountSwitcher()
    trigger().click()
    await nextTick()

    const [sideProject, acme, create] = items()

    expect(items()).toHaveLength(3)
    expect(sideProject!.textContent).toMatch(/Side project\s*Owner/)
    expect(acme!.textContent).toMatch(/Acme Sales\s*Editor/)
    expect(create!.textContent!.trim()).toBe('Create workspace')
  })

  it('moves with the arrows and wraps', async () => {
    await mountSwitcher()
    trigger().click()
    await nextTick()
    await nextTick()

    await press('ArrowDown')
    expect(document.activeElement?.textContent).toContain('Create workspace')

    await press('ArrowDown')
    expect(document.activeElement?.textContent).toContain('Side project')

    await press('End')
    expect(document.activeElement?.textContent).toContain('Create workspace')
  })

  it('closes on Escape without letting the key reach the document, and refocuses', async () => {
    await mountSwitcher()
    trigger().click()
    await nextTick()
    await nextTick()
    const heard = vi.fn()
    document.addEventListener('keydown', heard)

    await press('Escape')

    document.removeEventListener('keydown', heard)
    expect(panel()).toBeNull()
    expect(heard).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger())
  })

  it('opens the form for a new workspace, closing the menu', async () => {
    await mountSwitcher()
    trigger().click()
    await nextTick()

    items().at(-1)!.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())

    expect(panel()).toBeNull()
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('New workspace')
  })
})
