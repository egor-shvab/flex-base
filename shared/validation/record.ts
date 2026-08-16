import { z } from 'zod'
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
import type { IField, TFieldType } from '#shared/types/field'
import type {
  IRecordQueryParams,
  TRecordData,
  TRecordSingleValue,
  TRecordValue,
} from '#shared/types/record'
import { choiceValues, isMultiValue } from '#shared/utils/field'
import { claimFilterParams, filterShapeFor, queryColumns } from '#shared/utils/filter'

const TEXT_MAX_LENGTH = 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface IValueSchemaRules {
  /** Schema for a filled-in value of this type; nullability is layered on top. */
  base: (field: IField) => z.ZodType<TRecordSingleValue>
  /**
   * The **element** schema when this type holds a list, or `null` when it has no list form.
   * Declared rather than derived from `base`: only a type whose values are strings can be
   * stored as a JSON array, and stating that per type is what lets `buildMultiValueSchema`
   * produce a real `z.ZodType<string[]>` instead of casting one into existence.
   *
   * Agrees with `MULTI_VALUE_BY_TYPE` by construction — both are declared per type, and the
   * two are checked together where a field's cardinality is resolved.
   */
  listBase: ((field: IField) => z.ZodType<string>) | null
  /** What a blank input produces — also the seed value for a new record. */
  blank: TRecordSingleValue
  /** Decodes a raw query-string value before `base` validates it — a URL carries only strings. */
  fromQuery: (raw: string) => unknown
}

/** SELECT's choices, shared by its single and list schemas so the two cannot drift. */
function choiceEnum(field: IField): z.ZodType<string> {
  return z.enum(choiceValues(field) as [string, ...string[]], 'Choose a value')
}

/** A target record's id — the same schema whether a field holds one or several. */
function relationId(): z.ZodType<string> {
  return z.string().min(1, 'Choose a record')
}

/**
 * The single per-field-type branch point for record values. A new field type adds
 * one entry here and one entry in the component registry — nothing else changes.
 */
const VALUE_SCHEMA_BY_TYPE: Record<TFieldType, IValueSchemaRules> = {
  TEXT: {
    base: () =>
      z.string().trim().max(TEXT_MAX_LENGTH, `Must be at most ${TEXT_MAX_LENGTH} characters`),
    listBase: null,
    blank: null,
    fromQuery: (raw) => raw,
  },
  NUMBER: {
    base: () => z.number('Enter a number').finite('Enter a number'),
    listBase: null,
    blank: null,
    fromQuery: (raw) => Number(raw),
  },
  // `false` is a real value, so a checkbox is never "missing" and `required` is a no-op
  BOOLEAN: {
    base: () => z.boolean(),
    listBase: null,
    blank: false,
    fromQuery: (raw) => raw === 'true',
  },
  DATE: {
    base: () => z.string().regex(ISO_DATE, 'Enter a valid date'),
    listBase: null,
    blank: null,
    fromQuery: (raw) => raw,
  },
  SELECT: {
    base: choiceEnum,
    listBase: choiceEnum,
    blank: null,
    fromQuery: (raw) => raw,
  },
  // A target record's id. That the record exists is a database question, so the server
  // layers `assertRelationTargets` on top of what is knowable here.
  RELATION: {
    base: relationId,
    listBase: relationId,
    blank: null,
    fromQuery: (raw) => raw,
  },
}

/** The value the form seeds a blank input with, per field. A multi-value field starts empty. */
export function blankValueFor(field: IField): TRecordValue {
  return isMultiValue(field) ? [] : VALUE_SCHEMA_BY_TYPE[field.type].blank
}

/**
 * A multi-value field's schema is its type's own value schema **lifted into an array** — the
 * type still says what one value is, and cardinality says how many of them there may be. That
 * is the whole of what multi costs the validation layer: no type declares a second schema.
 *
 * Duplicates are rejected rather than deduplicated, matching how `fieldSchema` judges repeated
 * SELECT choices — a control cannot produce them (picking a chosen option toggles it off), so
 * a repeat is a crafted payload and should be answered rather than quietly cleaned up. It also
 * keeps a `.transform()` out of a layer that only judges.
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

  // A blank control and a field the payload omits both mean "nothing chosen", which for a
  // list is the empty one — the counterpart of `blank` for the single-value branch below
  return z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? [] : value),
    list,
  )
}

function buildValueSchema(field: IField): z.ZodType<TRecordValue> {
  const rules = VALUE_SCHEMA_BY_TYPE[field.type]

  // Both halves are per-type declarations, so testing them together is what proves to the
  // compiler that a multi-value field really does have an element schema
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
  // Declared on the base rather than left to the loose object: this is what caps the length
  // and enforces the floor, so an unanchored scan can never be triggered by one character.
  // The `superRefine` below cannot serve it — that loop is driven by the filter param claims.
  //
  // A blank param is *absent*, not a term of length zero — the same reading every filter param
  // gets, and the one `parseRecordQueryState` already has. Without the preprocess a present
  // `?search=` reaches `min()` and answers a 400 for a link that means "not searching".
  search: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(SEARCH_MIN_LENGTH).max(TEXT_MAX_LENGTH).optional(),
  ),
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

      // A list is the one shape that may repeat its param; every other one takes exactly one
      // value, so an array there is malformed rather than generous. Read off the *field*, so a
      // multi-value RELATION reads its repeats where a single-value one still rejects them.
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
