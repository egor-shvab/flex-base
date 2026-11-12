import { computed } from 'vue'
import { useRoute } from '#imports'

/** The workspace the current page belongs to, by its address — `''` on a page outside one. */
export function useActiveWorkspace() {
  const route = useRoute()

  return {
    workspaceAddress: computed(() => String(route.params.workspaceAddress ?? '')),
  }
}
