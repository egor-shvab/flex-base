import { ref, shallowRef } from 'vue'

/**
 * A list a store holds for one workspace at a time: the one last fetched. An answer or a change for
 * a workspace switched away from belongs to a list no longer held, so it is dropped.
 */
export function useWorkspaceCollection<TItem extends { id: string }>() {
  const items = shallowRef<TItem[]>([])
  const loadedWorkspaceAddress = ref('')

  function isLoadedWorkspace(workspaceAddress: string): boolean {
    return workspaceAddress === loadedWorkspaceAddress.value
  }

  /** Emptied first on a switch, or the previous workspace's list shows until the answer lands. */
  async function fetchItems(workspaceAddress: string, request: () => Promise<TItem[]>) {
    if (!isLoadedWorkspace(workspaceAddress)) items.value = []
    loadedWorkspaceAddress.value = workspaceAddress

    const fetched = await request()
    if (isLoadedWorkspace(workspaceAddress)) items.value = fetched
    return fetched
  }

  /** Replaces the item with the same id, or appends it: the lists are ordered oldest first. */
  function applyItem(workspaceAddress: string, next: TItem) {
    if (!isLoadedWorkspace(workspaceAddress)) return

    items.value = items.value.some((item) => item.id === next.id)
      ? items.value.map((item) => (item.id === next.id ? next : item))
      : [...items.value, next]
  }

  function removeItem(workspaceAddress: string, id: string) {
    if (isLoadedWorkspace(workspaceAddress))
      items.value = items.value.filter((item) => item.id !== id)
  }

  return { items, loadedWorkspaceAddress, fetchItems, applyItem, removeItem }
}
