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

export function blankValueFor(field: IField): TRecordValue {
  return isMultiValue(field) ? [] : VALUE_SCHEMA_BY_TYPE[field.type].blank
}

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

  return z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? [] : value),
    list,
  )
}

function buildValueSchema(field: IField): z.ZodType<TRecordValue> {
  const rules = VALUE_SCHEMA_BY_TYPE[field.type]

  if (isMultiValue(field) && rules.listBase) return buildMultiValueSchema(field, rules.listBase)

  const nullable = rules.base(field).nullable()

  const enforceRequired = field.required && rules.blank === null

  return z.preprocess(
    (value) => (value === '' || value === undefined ? rules.blank : value),
    enforceRequired
      ? nullable.refine((value) => value !== null, { error: `${field.name} is required` })
      : nullable,
  )
}

export function buildRecordSchema(fields: IField[]): z.ZodType<TRecordData> {
  return z.object(Object.fromEntries(fields.map((field) => [field.key, buildValueSchema(field)])))
}

export function buildFilterValueSchema(field: IField): z.ZodType<TRecordSingleValue> {
  const rules = VALUE_SCHEMA_BY_TYPE[field.type]

  return z.preprocess(
    (value) => (typeof value === 'string' ? rules.fromQuery(value) : value),
    rules.base(field),
  )
}

const baseQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(RECORD_PAGE_SIZE_MAX).default(RECORD_PAGE_SIZE),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).default(DEFAULT_SORT_DIRECTION),
  // A blank param is absent, not a zero-length term: without the preprocess `?search=` reaches
  // `min()` and 400s a link that means "not searching"
  search: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(SEARCH_MIN_LENGTH).max(TEXT_MAX_LENGTH).optional(),
  ),
})

export function buildRecordQuerySchema(fields: IField[]): z.ZodType<IRecordQueryParams> {
  const columns = queryColumns(fields)
  const fieldByKey = new Map(columns.map((field) => [field.key, field]))
  const claims = claimFilterParams(columns)

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
