import type { Prisma } from '#server/generated/prisma/client'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'

/**
 * How a filter value compares against a field's projected expression. Each builder narrows by
 * shape and yields no condition otherwise — validation guarantees the shape, so that branch is
 * a guard. The parameter is widened to `TFilterValue` because indexing a mapped type by a union
 * in *parameter* position collapses to an intersection, making the map uncallable.
 */
export type TFilterSql = (expr: Prisma.Sql, value: TFilterValue) => Prisma.Sql | null

/**
 * Which kind of index can serve a comparison. The kind follows how the type **compares**, not
 * what it stores: an unanchored `ILIKE` needs trigrams, a range a B-tree, a multi-value overlap
 * a GIN on the sub-path.
 */
export type TFieldIndexKind = 'btree' | 'trigram' | 'gin'

/** An ordering that reaches another row: what to join, and what to order by once joined. */
export interface IJoinedSort {
  join: Prisma.Sql
  expr: Prisma.Sql
}

export interface IFieldSqlRules {
  /** Projects the stored JSONB value to a comparable expression — what a filter compares against. */
  expr: (key: string) => Prisma.Sql
  /** How the column orders, for a type that reads as something other than the value it stores. */
  sortExpr?: (field: IField) => Prisma.Sql
  /**
   * How this type orders when the value it sorts by lives in **another row**. Takes precedence
   * over `sortExpr`, and `null` for every type whose ordering is local. Separate because a join
   * belongs to `FROM` and an expression to `ORDER BY`, and only the caller knows where its
   * `FROM` is. RELATION alone needs it: a per-row subquery measured 1 528 ms over 800k rows
   * against 171 ms for the join.
   */
  sortJoin: ((field: IField, alias: string) => IJoinedSort) | null
  /**
   * How free-text search matches this type, as a whole **predicate**, or `null` to exclude it.
   * Separate from `expr` because NUMBER and BOOLEAN cast, and neither `numeric` nor `boolean`
   * has an `ILIKE` operator. A predicate rather than an expression the caller appends `ILIKE`
   * to, because a multi-value column has to ask whether *any element* matches.
   */
  searchPredicate: (key: string, pattern: string) => Prisma.Sql | null
  /** Compares this type's filter value against that expression. */
  filter: TFilterSql
  /**
   * Which index kind serves `filter`, or `null` when none can. Read together with `expr`: the
   * index is built on that same projection, so the two move as one.
   */
  filterIndex: TFieldIndexKind | null
  /**
   * Which index kind serves the ordering, or `null` for a projection no index can cover —
   * RELATION orders by a value in another row, and its `sortJoin` brings that row in instead.
   * Only ever `'btree'` today, since an ordering wants a sorted structure; typed as the full
   * union so a type that finds another answer can say so.
   */
  sortIndex: TFieldIndexKind | null
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
