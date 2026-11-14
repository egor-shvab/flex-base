export interface IRequestTicket {
  signal: AbortSignal
  /** False once a newer request started or the run was cancelled: its outcome must be dropped. */
  isCurrent: () => boolean
}

export interface ILatestRequest {
  start: () => IRequestTicket
  cancel: () => void
}

/**
 * Last request wins: starting one aborts the one before, and a response that still arrives late
 * is recognised as stale, so it can neither overwrite newer state nor surface its error.
 */
export function createLatestRequest(): ILatestRequest {
  let controller: AbortController | undefined

  return {
    start() {
      controller?.abort()
      const own = new AbortController()
      controller = own

      return { signal: own.signal, isCurrent: () => controller === own }
    },
    cancel() {
      controller?.abort()
      controller = undefined
    },
  }
}
