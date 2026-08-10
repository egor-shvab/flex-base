/**
 * Stands in for `nitropack/runtime`, which cannot be imported outside a Nitro build — its
 * entry pulls in `#nitro-internal-virtual/*` specifiers that only exist once Nitro has
 * generated them. Without this, the three modules that read runtime config (both auth
 * endpoints and the server auth middleware) could not be loaded at all.
 *
 * Only `useRuntimeConfig` is provided, and it resolves exactly what `nuxt.config.ts` declares:
 * `jwtSecret` from the environment. So the shim reproduces the real mapping rather than
 * inventing one — everything else in those handlers runs unstubbed.
 */
export function useRuntimeConfig(): { jwtSecret: string } {
  return { jwtSecret: process.env.JWT_SECRET ?? '' }
}
