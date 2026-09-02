import type { z } from 'zod'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, IFilterValueRules } from '#shared/types/filter'
import type { TRecordSingleValue } from '#shared/types/record'

/** What one field type declares about the values it holds. */
export interface IValueSchemaRules {
  /** Schema for a filled-in value of this type; nullability is layered on top. */
  base: (field: IField) => z.ZodType<TRecordSingleValue>
  /**
   * The **element** schema when this type holds a list, or `null` when it has no list form.
   * Declared rather than derived from `base`: only a string-valued type can be stored as a JSON
   * array, and stating that per type is what lets `buildMultiValueSchema` produce a real
   * `z.ZodType<string[]>` rather than casting one into existence. Agrees with `multiValue` by
   * construction, since the same module declares both.
   */
  listBase: ((field: IField) => z.ZodType<string>) | null
  /** What a blank input produces — also the seed value for a new record. */
  blank: TRecordSingleValue
  /** Decodes a raw query-string value before `base` validates it — a URL carries only strings. */
  fromQuery: (raw: string) => unknown
}

/**
 * Everything a field type is to **both** sides of the wire: its name, whether it may hold
 * several values, how its filter value is shaped, and what one of its values must be.
 *
 * One module per type declares this, and `registry.ts` is the only file enumerating them. The
 * SQL half lives in `server/db/field-types/` and the rendering half in `app/field-types/`,
 * because one module holding all three would drag `Prisma.Sql` into the browser (`CLAUDE.md`
 * §9).
 *
 * **Every key is required and nullable, never optional**, so a new type states its position on
 * each axis rather than inheriting one by omission.
 */
export interface IFieldTypeModule<K extends TFieldType> {
  /** How the type is named wherever a user chooses one. */
  label: string
  /**
   * Whether a field of this type may be configured to hold several values. A per-field setting
   * rather than a second field type, so an existing field can be widened in place where a type
   * never can (`updateField` rejects type changes). `isMultiValue` is the only reader.
   */
  multiValue: boolean
  /**
   * The shape of this type's filter value, and what "not filtered" is. No operator anywhere:
   * the shape names the query params, and the server derives the comparison from it.
   */
  filter: IFilterValueRules<IFilterValueByType[K]>
  value: IValueSchemaRules
}
