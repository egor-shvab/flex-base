import { z } from 'zod'
import { nameSchema } from '#shared/validation/name'

export const tableSchema = z.object({
  name: nameSchema,
})

export type TTableInput = z.infer<typeof tableSchema>
