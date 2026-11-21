import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useScrollEdges } from '~/composables/useScrollEdges'
import { track, unmountAll } from '~~/test/mount'

const CLIENT_WIDTH = 300
const SCROLL_WIDTH = 500

let resizeCallback: (() => void) | undefined
const disconnect = vi.fn()

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }

      observe() {}

      disconnect = disconnect
    },
  )
})

afterEach(() => {
  unmountAll()
  vi.unstubAllGlobals()
  disconnect.mockClear()
  resizeCallback = undefined
})

/** Untracked only for the case that unmounts it itself: a second unmount warns. */
function host(scrollWidth = SCROLL_WIDTH, isTracked = true) {
  let edges!: ReturnType<typeof useScrollEdges>

  const mounted = mount(
    defineComponent({
      setup() {
        const boxRef = ref<HTMLElement>()
        edges = useScrollEdges(boxRef)

        return () =>
          h('div', {
            ref: (element) => {
              if (!(element instanceof HTMLElement)) return
              Object.defineProperty(element, 'clientWidth', { value: CLIENT_WIDTH })
              Object.defineProperty(element, 'scrollWidth', {
                value: scrollWidth,
                configurable: true,
              })
              boxRef.value = element
            },
          })
      },
    }),
    { attachTo: document.body },
  )
  const wrapper = isTracked ? track(mounted) : mounted

  return { edges, box: wrapper.element as HTMLElement, wrapper }
}

async function scrollTo(box: HTMLElement, left: number) {
  box.scrollLeft = left
  box.dispatchEvent(new Event('scroll'))
  await nextTick()
}

describe('useScrollEdges', () => {
  it('reports only the end at rest when the content overflows', () => {
    const { edges } = host()

    expect(edges.canScrollStart.value).toBe(false)
    expect(edges.canScrollEnd.value).toBe(true)
  })

  it('reports neither when the content fits', () => {
    const { edges } = host(CLIENT_WIDTH)

    expect(edges.canScrollStart.value).toBe(false)
    expect(edges.canScrollEnd.value).toBe(false)
  })

  it('reports both midway and only the start at the end', async () => {
    const { edges, box } = host()

    await scrollTo(box, 100)
    expect(edges.canScrollStart.value).toBe(true)
    expect(edges.canScrollEnd.value).toBe(true)

    await scrollTo(box, SCROLL_WIDTH - CLIENT_WIDTH)
    expect(edges.canScrollStart.value).toBe(true)
    expect(edges.canScrollEnd.value).toBe(false)
  })

  it('measures again when the box resizes', () => {
    const { edges, box } = host()

    Object.defineProperty(box, 'scrollWidth', { value: CLIENT_WIDTH })
    resizeCallback?.()

    expect(edges.canScrollEnd.value).toBe(false)
  })

  it('stops observing once unmounted', () => {
    const { wrapper } = host(SCROLL_WIDTH, false)

    wrapper.unmount()

    expect(disconnect).toHaveBeenCalledOnce()
  })
})
