import { z } from 'zod'
import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY, SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE, RECORD_PAGE_SIZE_MAX } from '#shared/constants/record'
import type { IField, TFieldType } from '#shared/types/field'
import type { IRecordQueryParams, TRecordData, TRecordValue } from '#shared/types/record'
import { claimFilterParams, queryFields } from '#shared/utils/filter'

const TEXT_MAX_LENGTH = 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface IValueSchemaSpec {
  /** Schema for a filled-in value of this type; nullability is layered on top. */
  base: (field: IField) => z.ZodType<TRecordValue>
  /** What a blank input produces — also the seed value for a new record. */
  blank: TRecordValue
  /** Decodes a raw query-string value before `base` validates it — a URL carries only strings. */
  fromQuery: (raw: string) => unknown
}

/**
 * The single per-field-type branch point for record values. A new field type adds
 * one entry here and one entry in the component registry — nothing else changes.
 */
const VALUE_SCHEMA_BY_TYPE: Record<TFieldType, IValueSchemaSpec> = {
  TEXT: {
    base: () =>
      z.string().trim().max(TEXT_MAX_LENGTH, `Must be at most ${TEXT_MAX_LENGTH} characters`),
    blank: null,
    fromQuery: (raw) => raw,
  },
  NUMBER: {
    base: () => z.number('Enter a number').finite('Enter a number'),
    blank: null,
    fromQuery: (raw) => Number(raw),
  },
  // `false` is a real value, so a checkbox is never "missing" and `required` is a no-op
  BOOLEAN: {
    base: () => z.boolean(),
    blank: false,
    fromQuery: (raw) => raw === 'true',
  },
  DATE: {
    base: () => z.string().regex(ISO_DATE, 'Enter a valid date'),
    blank: null,
    fromQuery: (raw) => raw,
  },
  SELECT: {
    base: (field) =>
      z.enum((field.options?.choices ?? []) as [string, ...string[]], 'Choose a value'),
    blank: null,
    fromQuery: (raw) => raw,
  },
  // A target record's id. That the record exists is a database question, so the server
  // layers `assertRelationTargets` on top of what is knowable here.
  RELATION: {
    base: () => z.string().min(1, 'Choose a record'),
    blank: null,
    fromQuery: (raw) => raw,
  },
}

/** The value the form seeds a blank input with, per field type. */
export function blankValueFor(field: IField): TRecordValue {
  return VALUE_SCHEMA_BY_TYPE[field.type].blank
}

function buildValueSchema(field: IField): z.ZodType<TRecordValue> {
  const spec = VALUE_SCHEMA_BY_TYPE[field.type]
  const nullable = spec.base(field).nullable()

  // Only a type whose blank value is null can actually be missing, so `required`
  // is enforced for those alone — no field-type check needed here.
  const enforceRequired = field.required && spec.blank === null

  return z.preprocess(
    (value) => (value === '' || value === undefined ? spec.blank : value),
    enforceRequired
      ? nullable.refine((value) => value !== null, { error: `${field.name} is required` })
      : nullable,
  )
}

/**
 * Builds the validation schema for one table's records straight from its field
 * metadata — the same schema validates the client form and the API payload.
 * Unknown keys are stripped, so nothing but declared fields reaches the JSONB column.
 */
export function buildRecordSchema(fields: IField[]): z.ZodType<TRecordData> {
  return z.object(Object.fromEntries(fields.map((field) => [field.key, buildValueSchema(field)])))
}

/**
 * A filter value arrives as a query string, so it is decoded before its value schema runs.
 * Exported for the URL codec (`#shared/utils/record-query`), which decodes with the very
 * same schema the query validation uses.
 */
export function buildFilterValueSchema(field: IField): z.ZodType<TRecordValue> {
  const spec = VALUE_SCHEMA_BY_TYPE[field.type]

  return z.preprocess(
    (value) => (typeof value === 'string' ? spec.fromQuery(value) : value),
    spec.base(field),
  )
}

/** Pagination, sorting and search; the per-field filter params are validated by the builder below. */
const baseQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(RECORD_PAGE_SIZE_MAX).default(RECORD_PAGE_SIZE),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).default(DEFAULT_SORT_DIR),
  // Declared on the base rather than left to the loose object: this is what caps the length
  // and enforces the floor, so an unanchored scan can never be triggered by one character.
  // The `superRefine` below cannot serve it — that loop is driven by the filter param slots.
  search: z.string().trim().min(SEARCH_MIN_LENGTH).max(TEXT_MAX_LENGTH).optional(),
})

/**
 * Builds the list-query schema from one table's field metadata — the same contract as
 * `buildRecordSchema`. An unknown sort key or a malformed filter value fails here as a
 * 400, before any SQL is composed. Params the table does not own are simply stripped:
 * filter names are plain field names now, so a stray `utm_source` is indistinguishable
 * from a typo and must not break the page.
 *
 * Validation only — decoding the validated params into an `IRecordQuery` is the codec's
 * job (`parseRecordQueryState`), so a link is read by one reader on both sides of the wire.
 */
export function buildRecordQuerySchema(fields: IField[]): z.ZodType<IRecordQueryParams> {
  // The record's own columns sort and filter like fields, so they judge the params too
  const columns = queryFields(fields)
  const fieldByKey = new Map(columns.map((field) => [field.key, field]))
  const slots = claimFilterParams(columns)

  // Loose, so the refinement sees the filter params without widening the base ones
  return baseQueryParamsSchema.loose().superRefine((params, ctx) => {
    if (params.sort !== undefined && params.sort !== DEFAULT_SORT_KEY) {
      if (!fieldByKey.has(params.sort)) {
        ctx.addIssue({ code: 'custom', path: ['sort'], message: 'Unknown sort field' })
      }
    }

    for (const { field, name } of slots) {
      const raw = params[name]
      if (raw === undefined) continue

      // A repeated param arrives as an array — one value per filter, so that is malformed
      if (typeof raw !== 'string') {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Filter takes a single value' })
        continue
      }

      if (raw !== '' && !buildFilterValueSchema(field).safeParse(raw).success) {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Invalid filter value' })
      }
    }
  })
}
