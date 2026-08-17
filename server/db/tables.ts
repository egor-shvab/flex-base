import type { Prisma } from '#server/generated/prisma/client'

/**
 * The table itself, without the counts only the dashboard needs. Shared by the table service
 * and by the ownership helpers, which is why it lives here rather than in either of them.
 */
export const tableSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSelect

/** The same plus the counts the dashboard and the sidebar draw. */
export const tableListSelect = {
  ...tableSelect,
  _count: { select: { fields: true, records: true } },
} satisfies Prisma.TableSelect
