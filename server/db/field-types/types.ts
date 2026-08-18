import type { Prisma } from '#server/generated/prisma/client'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'

/**
 * How a filter value compares against a field's projected expression. Each builder narrows
 * the value by shape and yields no condition when it does not match — validation guarantees
 * the shape, so that branch is a guard rather than behaviour.
 *
 * The value parameter is widened to `TFilterValue` rather than indexed per type: indexing a
 * mapped type by a union in *parameter* position collapses to an intersection, which would
 * make the map uncallable for an arbitrary field.
 */
export type TFilterSql = (expr: Prisma.Sql, value: TFilterValue) => Prisma.Sql | null

export interface IFieldSqlRules {
  /** Projects the stored JSONB value to a comparable expression — what a filter compares against. */
  expr: (key: string) => Prisma.Sql
  /** How the column orders, for a type that reads as something other than the value it stores. */
  sortExpr?: (field: IField) => Prisma.Sql
  /**
   * How free-text search matches this type, as a whole **predicate**, or `null` to exclude it.
   * Separate from `expr` because two types cannot be searched the way they are filtered:
   * NUMBER and BOOLEAN cast, and neither `numeric` nor `boolean` has an `ILIKE` operator.
   *
   * A predicate rather than an expression the caller appends `ILIKE` to, because a multi-value
   * column cannot be matched by comparing one expression — it has to ask whether *any element*
   * matches, which is a shape no projection can express.
   */
  searchPredicate: (key: string, pattern: string) => Prisma.Sql | null
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
}

/**
 * One field type's whole SQL surface. `multi` is how the type behaves when a field holds
 * **several** values instead of one — the same lifting the validation layer applies, expressed
 * in SQL — or `null` when the type has no list form, which `multiValue` in the shared module
 * already refuses to configure. The two agree by construction; a spec is what joins them,
 * since they sit in different slices (`CLAUDE.md` §10).
 *
 * Required and nullable, never optional: a new field type must state its position.
 */
export interface IFieldSqlModule {
  sql: IFieldSqlRules
  multi: IFieldSqlRules | null
}
