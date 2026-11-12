import { describe, expect, it } from 'vitest'
import { useWorkspaceCollection } from '~/composables/useWorkspaceCollection'

const WS = 'k3f9x2m8qa'
const OTHER_WS = 'p7q2w9e4rt'

interface IItem {
  id: string
  name: string
}

describe('useWorkspaceCollection', () => {
  it('holds the list of the workspace fetched last, emptied while another loads', async () => {
    const collection = useWorkspaceCollection<IItem>()
    await collection.fetchItems(WS, async () => [{ id: 'a', name: 'Ada' }])

    let resolveOther: (items: IItem[]) => void = () => {}
    const other = collection.fetchItems(
      OTHER_WS,
      () => new Promise((resolve) => (resolveOther = resolve)),
    )

    expect(collection.items.value).toEqual([])
    resolveOther([{ id: 'b', name: 'Bob' }])
    await other
    expect(collection.items.value).toEqual([{ id: 'b', name: 'Bob' }])
    expect(collection.loadedWorkspaceAddress.value).toBe(OTHER_WS)
  })

  it('drops an answer for a workspace switched away from', async () => {
    const collection = useWorkspaceCollection<IItem>()
    let resolveFirst: (items: IItem[]) => void = () => {}
    const first = collection.fetchItems(
      WS,
      () => new Promise((resolve) => (resolveFirst = resolve)),
    )

    await collection.fetchItems(OTHER_WS, async () => [{ id: 'b', name: 'Bob' }])
    resolveFirst([{ id: 'a', name: 'Ada' }])
    await first

    expect(collection.items.value).toEqual([{ id: 'b', name: 'Bob' }])
  })

  it('replaces an item by its id, or appends a new one', async () => {
    const collection = useWorkspaceCollection<IItem>()
    await collection.fetchItems(WS, async () => [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bob' },
    ])

    collection.applyItem(WS, { id: 'a', name: 'Ada L.' })
    collection.applyItem(WS, { id: 'c', name: 'Cy' })
    collection.removeItem(WS, 'b')

    expect(collection.items.value.map((item) => item.name)).toEqual(['Ada L.', 'Cy'])
  })

  it('ignores a change for a workspace it does not hold', async () => {
    const collection = useWorkspaceCollection<IItem>()
    await collection.fetchItems(WS, async () => [{ id: 'a', name: 'Ada' }])

    collection.applyItem(OTHER_WS, { id: 'z', name: 'Zed' })
    collection.removeItem(OTHER_WS, 'a')

    expect(collection.items.value).toEqual([{ id: 'a', name: 'Ada' }])
  })
})
