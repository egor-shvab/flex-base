import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { assertJwtSecret } from '#server/utils/auth'

export default defineNitroPlugin(() => {
  assertJwtSecret(useRuntimeConfig().jwtSecret)
})
