import { z } from 'zod'

/**
 * The rule for every user-visible name in the app — tables and fields alike. One schema,
 * so the two cannot drift apart in length or in the message the user reads.
 */
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')
