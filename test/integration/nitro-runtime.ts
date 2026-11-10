/**
 * `nitropack/runtime` cannot be imported outside a Nitro build. Provides only `useRuntimeConfig`,
 * mapped exactly as `nuxt.config.ts` declares it.
 */
export function useRuntimeConfig(): { jwtSecret: string } {
  return { jwtSecret: process.env.JWT_SECRET ?? '' }
}
