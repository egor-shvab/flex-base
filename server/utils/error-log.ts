import { isError } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

export interface IErrorLogRequest {
  method: string
  path: string
  queryKeys: string[]
  userId: string | null
}

export type TErrorLogSource = 'server' | 'client'

export interface IErrorLogEntry {
  source: TErrorLogSource
  timestamp: string
  statusCode: number | null
  name: string
  message: string
  stack: string | null
  method: string | null
  path: string | null
  queryKeys: string[] | null
  userId: string | null
}

interface IErrorLogEventSource {
  method: string
  path: string
  context: { user: IAuthUser | null }
}

/** A 4xx is deliberate flow, and a zod 400's `data.issues` echoes the submitted value. */
export function isLoggableServerError(error: unknown): boolean {
  if (!isError(error)) return true
  return error.statusCode >= 500
}

/**
 * Redaction is structural: never headers (the auth cookie), the body (a password) or query
 * values. A scrub afterwards would be a list someone can forget to extend.
 */
export function readErrorLogRequest(source: IErrorLogEventSource): IErrorLogRequest {
  const [path = '', query = ''] = source.path.split('?')
  const queryKeys = [...new Set(new URLSearchParams(query).keys())].sort()

  return {
    method: source.method,
    path,
    queryKeys,
    userId: source.context.user?.id ?? null,
  }
}

function originOf(error: unknown): Error {
  if (isError(error) && error.cause instanceof Error) return error.cause
  return error instanceof Error ? error : new Error(String(error))
}

export function buildErrorLogEntry(
  error: unknown,
  request: IErrorLogRequest | null,
  now: Date,
): IErrorLogEntry {
  const origin = originOf(error)

  return {
    source: 'server',
    timestamp: now.toISOString(),
    statusCode: isError(error) ? error.statusCode : null,
    name: origin.name,
    message: origin.message,
    stack: origin.stack ?? null,
    method: request?.method ?? null,
    path: request?.path ?? null,
    queryKeys: request?.queryKeys ?? null,
    userId: request?.userId ?? null,
  }
}

interface IClientErrorReportSource {
  name: string
  message: string
  stack?: string
  path: string
}

/**
 * The user id comes from the cookie, never the report, and the path is cut at `?` so a query
 * value pasted into it never reaches the file.
 */
export function buildClientErrorLogEntry(
  report: IClientErrorReportSource,
  userId: string | null,
  now: Date,
): IErrorLogEntry {
  const [path = ''] = report.path.split('?')

  return {
    source: 'client',
    timestamp: now.toISOString(),
    statusCode: null,
    name: report.name,
    message: report.message,
    stack: report.stack ?? null,
    method: null,
    path,
    queryKeys: null,
    userId,
  }
}

export function formatErrorLogLine(entry: IErrorLogEntry): string {
  return `${JSON.stringify(entry)}\n`
}
