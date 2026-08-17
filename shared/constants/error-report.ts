/**
 * What a browser may report about an error it raised, and how much of it. Shared because both
 * halves need the same numbers: the client truncates to them before sending, and the schema
 * refuses anything past them. A client that did not truncate would have its report rejected as a
 * 400 and lose the very error it was reporting.
 */
export const CLIENT_ERROR_LIMITS = {
  name: 200,
  message: 1000,
  stack: 8000,
  path: 500,
} as const

/**
 * The hard ceiling on one report's body, checked against `content-length` **before** the stream is
 * read. Comfortably above the field limits above once JSON escaping is allowed for; this is a
 * ceiling on an unauthenticated write surface, not a product rule.
 */
export const CLIENT_ERROR_MAX_BYTES = 16 * 1024

/**
 * How many reports one page load may send. A render loop raises the same error every frame, so
 * without a cap a single broken component floods both the endpoint and the log file.
 */
export const CLIENT_ERROR_REPORTS_PER_PAGE = 5

/** How many reports one address may send per window, and how long that window is. */
export const CLIENT_ERROR_RATE_LIMIT = 20
export const CLIENT_ERROR_RATE_WINDOW_MS = 60_000
