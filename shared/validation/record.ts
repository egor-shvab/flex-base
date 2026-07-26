import { z } from 'zod'
import type { IField, TFieldType } from '#shared/types/field'
import type { TRecordData, TRecordValue } from '#shared/types/record'

const TEXT_MAX_LENGTH = 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const RECORD_PAGE_SIZE = 50
export const RECORD_PAGE_SIZE_MAX = 100

interface IValueSchemaSpec {
  /** Schema for a filled-in value of this type; nullability is layered on top. */
  base: (field: IField) => z.ZodType<TRecordValue>
  /** What a blank input produces — also the seed value for a new record. */
  blank: TRecordValue
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
  },
  NUMBER: {
    base: () => z.number('Enter a number').finite('Enter a number'),
    blank: null,
  },
  // `false` is a real value, so a checkbox is never "missing" and `required` is a no-op
  BOOLEAN: {
    base: () => z.boolean(),
    blank: false,
  },
  DATE: {
    base: () => z.string().regex(ISO_DATE, 'Enter a valid date'),
    blank: null,
  },
  SELECT: {
    base: (field) =>
      z.enum((field.options?.choices ?? []) as [string, ...string[]], 'Choose a value'),
    blank: null,
  },
  // Placeholder until the RELATION milestone — RELATION is not creatable yet
  RELATION: {
    base: () => z.string().min(1),
    blank: null,
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

export const recordQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(RECORD_PAGE_SIZE_MAX).default(RECORD_PAGE_SIZE),
})

export type TRecordQuery = z.infer<typeof recordQuerySchema>
