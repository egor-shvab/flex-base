import { z } from 'zod'

export const tableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
})

export type TTableInput = z.infer<typeof tableSchema>
