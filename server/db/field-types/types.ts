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

/**
 * Which kind of index can serve a comparison. The kind follows how the type **compares**, not
 * what it stores: an unanchored `ILIKE` needs trigrams where a range needs a B-tree, and a
 * multi-value overlap needs a GIN on the sub-path. A single kind per field would serve some of
 * them and silently fail to serve the rest.
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
   * How this type orders when the value it sorts by lives in **another row** — the join to bring
   * that row in, and the expression to order by once it is there. Takes precedence over
   * `sortExpr`, and `null` for every type whose ordering is local.
   *
   * Separate from `sortExpr` because a join belongs to `FROM` and an expression to `ORDER BY`, and
   * only the caller knows where its `FROM` is. RELATION is the only type that needs it: reading
   * the target's label per row instead costs a subquery per row, measured at 1 528 ms over 800k
   * rows against 171 ms for the join.
   */
  sortJoin: ((field: IField, alias: string) => IJoinedSort) | null
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
  /**
   * Which index kind serves `filter`, or `null` when none can. Read together with `expr`: the
   * index is built on that same projection, so the two move as one.
   */
  filterIndex: TFieldIndexKind | null
  /**
   * Which index kind serves the ordering, or `null` for a projection no index can cover —
   * RELATION orders by a value in another row, so nothing local to this table can stand in for
   * it — its `sortJoin` brings that row in instead.
   *
   * Only ever `'btree'` today: an ordering wants a sorted structure, which is the one thing GIN
   * does not give. Typed as the full union anyway so a type that finds another answer can say so.
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
