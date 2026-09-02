import { z } from 'zod'
import { nameSchema } from '#shared/validation/name'

export const tableInputSchema = z.object({
  name: nameSchema,
})

export type TTableInput = z.infer<typeof tableInputSchema>
