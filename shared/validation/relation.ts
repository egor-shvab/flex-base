import { z } from 'zod'

const RELATION_SEARCH_MAX_LENGTH = 100

export const relationOptionsQuerySchema = z.object({
  q: z.string().trim().max(RELATION_SEARCH_MAX_LENGTH).optional().default(''),
})
