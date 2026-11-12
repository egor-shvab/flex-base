import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useMenuNavigation } from '~/composables/useMenuNavigation'

function buildMenu(): HTMLElement {
  const panel = document.createElement('div')
  panel.setAttribute('role', 'menu')
  panel.innerHTML = `
    <a role="menuitemradio" tabindex="-1" href="#">First</a>
    <div role="separator"></div>
    <button role="menuitem" tabindex="-1">Second</button>
    <button role="menuitem" tabindex="-1">Third</button>
  `
  document.body.appendChild(panel)
  return panel
}

const focused = () => document.activeElement?.textContent

describe('useMenuNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses by position, counting a negative index from the end', () => {
    const { focusMenuItem } = useMenuNavigation(ref(buildMenu()))

    focusMenuItem(0)
    expect(focused()).toBe('First')

    focusMenuItem(-1)
    expect(focused()).toBe('Third')
  })

  it('steps over anything that is not an item, wrapping at both ends', () => {
    const { focusMenuItem, stepMenuFocus } = useMenuNavigation(ref(buildMenu()))
    focusMenuItem(0)

    stepMenuFocus(1)
    expect(focused()).toBe('Second')

    stepMenuFocus(-2)
    expect(focused()).toBe('Third')

    stepMenuFocus(1)
    expect(focused()).toBe('First')
  })

  it('does nothing while the panel is not rendered', () => {
    const { focusMenuItem, stepMenuFocus } = useMenuNavigation(ref<HTMLElement>())

    expect(() => focusMenuItem(0)).not.toThrow()
    expect(() => stepMenuFocus(1)).not.toThrow()
  })
})
