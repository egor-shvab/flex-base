import type { Prisma } from '#server/generated/prisma/client'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'

/**
 * `value` is widened to `TFilterValue`: indexing a mapped type by a union in parameter position
 * collapses to an intersection, making the map uncallable.
 */
export type TFilterSql = (expr: Prisma.Sql, value: TFilterValue) => Prisma.Sql | null

export type TFieldIndexKind = 'btree' | 'trigram' | 'gin'

export interface IJoinedSort {
  join: Prisma.Sql
  expr: Prisma.Sql
}

export interface IFieldSqlRules {
  expr: (key: string) => Prisma.Sql
  sortExpr?: (field: IField) => Prisma.Sql
  sortJoin: ((field: IField, alias: string) => IJoinedSort) | null
  searchPredicate: (key: string, pattern: string) => Prisma.Sql | null
  filter: TFilterSql
  filterIndex: TFieldIndexKind | null
  sortIndex: TFieldIndexKind | null
}

export interface IFieldSqlModule {
  sql: IFieldSqlRules
  multi: IFieldSqlRules | null
}
