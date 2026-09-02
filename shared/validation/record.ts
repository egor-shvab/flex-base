import { z } from 'zod'
import { isMultiValue } from '#shared/field-types/cardinality'
import { VALUE_SCHEMA_BY_TYPE } from '#shared/field-types/registry'
import { TEXT_MAX_LENGTH } from '#shared/field-types/text'
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  FILTER_VALUES_MAX,
  SEARCH_MIN_LENGTH,
} from '#shared/constants/filter'
import {
  MULTI_VALUE_MAX_ITEMS,
  RECORD_PAGE_SIZE,
  RECORD_PAGE_SIZE_MAX,
} from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type {
  IRecordQueryParams,
  TRecordData,
  TRecordSingleValue,
  TRecordValue,
} from '#shared/types/record'
import { claimFilterParams, filterShapeFor, queryColumns } from '#shared/utils/filter'

/** The value the form seeds a blank input with, per field. A multi-value field starts empty. */
export function blankValueFor(field: IField): TRecordValue {
  return isMultiValue(field) ? [] : VALUE_SCHEMA_BY_TYPE[field.type].blank
}

/**
 * A multi-value field's schema is its type's own value schema **lifted into an array** — the
 * type says what one value is, cardinality how many there may be, and no type declares a second
 * schema.
 *
 * Duplicates are rejected rather than deduplicated, as `fieldInputSchema` judges repeated SELECT
 * choices: a control cannot produce one, so a repeat is a crafted payload. It also keeps a
 * `.transform()` out of a layer that only judges.
 */
function buildMultiValueSchema(
  field: IField,
  listBase: (field: IField) => z.ZodType<string>,
): z.ZodType<string[]> {
  let list = z
    .array(listBase(field))
    .max(MULTI_VALUE_MAX_ITEMS, `Choose at most ${MULTI_VALUE_MAX_ITEMS} values`)
    .refine((values) => new Set(values).size === values.length, {
      error: `${field.name} cannot repeat a value`,
    })

  if (field.required) {
    list = list.refine((values) => values.length > 0, { error: `${field.name} is required` })
  }

  // A blank control and an omitted field both mean "nothing chosen" — for a list, the empty one
  return z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? [] : value),
    list,
  )
}

function buildValueSchema(field: IField): z.ZodType<TRecordValue> {
  const rules = VALUE_SCHEMA_BY_TYPE[field.type]

  // Both halves are per-type declarations, so testing them together proves to the compiler that
  // a multi-value field has an element schema
  if (isMultiValue(field) && rules.listBase) return buildMultiValueSchema(field, rules.listBase)

  const nullable = rules.base(field).nullable()

  // Only a type whose blank value is null can actually be missing, so `required`
  // is enforced for those alone — no field-type check needed here.
  const enforceRequired = field.required && rules.blank === null

  return z.preprocess(
    (value) => (value === '' || value === undefined ? rules.blank : value),
    enforceRequired
      ? nullable.refine((value) => value !== null, { error: `${field.name} is required` })
      : nullable,
  )
}

/**
 * One table's record schema, straight from its field metadata — the same schema validates the
 * form and the API payload. Unknown keys are stripped, so only declared fields reach the JSONB.
 */
export function buildRecordSchema(fields: IField[]): z.ZodType<TRecordData> {
  return z.object(Object.fromEntries(fields.map((field) => [field.key, buildValueSchema(field)])))
}

/**
 * A filter value arrives as a query string, so it is decoded before its value schema runs.
 * Exported for the URL codec, which decodes with the same schema the query validation uses.
 */
export function buildFilterValueSchema(field: IField): z.ZodType<TRecordSingleValue> {
  const rules = VALUE_SCHEMA_BY_TYPE[field.type]

  return z.preprocess(
    (value) => (typeof value === 'string' ? rules.fromQuery(value) : value),
    rules.base(field),
  )
}

/** Pagination, sorting and search; the per-field filter params are validated by the builder below. */
const baseQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(RECORD_PAGE_SIZE_MAX).default(RECORD_PAGE_SIZE),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).default(DEFAULT_SORT_DIRECTION),
  // On the base rather than the loose object: this caps the length and enforces the floor, so
  // one character cannot trigger an unanchored scan. The `superRefine` below is driven by the
  // filter param claims and cannot serve it.
  //
  // A blank param is *absent*, not a zero-length term — the reading every filter param gets.
  // Without the preprocess a present `?search=` reaches `min()` and 400s a link that means
  // "not searching".
  search: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(SEARCH_MIN_LENGTH).max(TEXT_MAX_LENGTH).optional(),
  ),
})

/**
 * The list-query schema from one table's field metadata — the same contract as
 * `buildRecordSchema`. An unknown sort key or malformed filter value 400s here, before any SQL
 * is composed. Params the table does not own are stripped: filter names are plain field names,
 * so a stray `utm_source` is indistinguishable from a typo and must not break the page.
 *
 * Validation only — decoding into an `IRecordQuery` is `parseRecordQueryState`'s job, so a link
 * is read by one reader on both sides of the wire.
 */
export function buildRecordQuerySchema(fields: IField[]): z.ZodType<IRecordQueryParams> {
  // The record's own columns sort and filter like fields, so they judge the params too
  const columns = queryColumns(fields)
  const fieldByKey = new Map(columns.map((field) => [field.key, field]))
  const claims = claimFilterParams(columns)

  // Loose, so the refinement sees the filter params without widening the base ones
  return baseQueryParamsSchema.loose().superRefine((params, ctx) => {
    if (params.sort !== undefined && params.sort !== DEFAULT_SORT_KEY) {
      if (!fieldByKey.has(params.sort)) {
        ctx.addIssue({ code: 'custom', path: ['sort'], message: 'Unknown sort field' })
      }
    }

    for (const { field, name } of claims) {
      const raw = params[name]
      if (raw === undefined) continue

      const schema = buildFilterValueSchema(field)

      // A list is the one shape that may repeat its param, so an array elsewhere is malformed.
      // Read off the *field*, so a multi-value RELATION accepts repeats where a single one does
      // not.
      if (filterShapeFor(field) === 'list') {
        const entries = Array.isArray(raw) ? raw : [raw]

        if (entries.length > FILTER_VALUES_MAX) {
          ctx.addIssue({ code: 'custom', path: [name], message: 'Too many filter values' })
          continue
        }

        for (const entry of entries) {
          if (typeof entry !== 'string' || (entry !== '' && !schema.safeParse(entry).success)) {
            ctx.addIssue({ code: 'custom', path: [name], message: 'Invalid filter value' })
            break
          }
        }

        continue
      }

      if (typeof raw !== 'string') {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Filter takes a single value' })
        continue
      }

      if (raw !== '' && !schema.safeParse(raw).success) {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Invalid filter value' })
      }
    }
  })
}
