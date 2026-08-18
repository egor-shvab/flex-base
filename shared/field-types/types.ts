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
   * Declared rather than derived from `base`: only a type whose values are strings can be
   * stored as a JSON array, and stating that per type is what lets `buildMultiValueSchema`
   * produce a real `z.ZodType<string[]>` instead of casting one into existence.
   *
   * Agrees with `multiValue` by construction — the same module declares both.
   */
  listBase: ((field: IField) => z.ZodType<string>) | null
  /** What a blank input produces — also the seed value for a new record. */
  blank: TRecordSingleValue
  /** Decodes a raw query-string value before `base` validates it — a URL carries only strings. */
  fromQuery: (raw: string) => unknown
}

/**
 * Everything a field type is to **both** sides of the wire: how it is named, whether it may
 * hold several values, how its filter value is shaped, and what one of its values must be.
 *
 * One module per type declares this; `registry.ts` is the only file that enumerates the six
 * and assembles them into the total maps every consumer reads. The SQL half lives in
 * `server/db/field-types/` and the rendering half in `app/field-types/`, because a module
 * holding all three would drag `Prisma.Sql` into the browser bundle (`CLAUDE.md` §9).
 *
 * **Every key is required and nullable, never optional.** That is what makes a new field type
 * state its position on each axis rather than inheriting one by omission.
 */
export interface IFieldTypeModule<K extends TFieldType> {
  /** How the type is named wherever a user chooses one. */
  label: string
  /**
   * Whether a field of this type may be configured to hold several values. Cardinality is a
   * per-field setting (`options.multiple`) rather than a second field type, so an existing
   * single-value field can be widened in place — a type never can, since `updateField`
   * rejects type changes. `isMultiValue` is the only reader.
   */
  multiValue: boolean
  /**
   * The shape of this type's filter value, and what "not filtered" is. There is no operator
   * anywhere: the shape names the query params, and the server derives the comparison from
   * the type and the same shape.
   */
  filter: IFilterValueRules<IFilterValueByType[K]>
  value: IValueSchemaRules
}
