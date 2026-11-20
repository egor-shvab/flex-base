import { createError } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'

/**
 * For the role pages: to a member who may not see roles they do not exist, so each is the same 404
 * as a page that is not there. Called in `setup`, where the workspace page has already loaded the
 * membership.
 */
export function useRequireRolesView(): void {
  const { hasPermission } = useActiveWorkspace()

  if (!hasPermission('ROLES_VIEW')) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
}
