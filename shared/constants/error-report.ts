export const CLIENT_ERROR_LIMITS = {
  name: 200,
  message: 1000,
  stack: 8000,
  path: 500,
} as const

export const CLIENT_ERROR_MAX_BYTES = 16 * 1024

export const CLIENT_ERROR_REPORTS_PER_PAGE = 5

export const CLIENT_ERROR_RATE_LIMIT = 20
export const CLIENT_ERROR_RATE_WINDOW_MS = 60_000
