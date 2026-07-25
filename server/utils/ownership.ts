/**
 * Asserts the table exists AND belongs to the user in a single scoped query.
 * Another user's table yields the same 404 as a missing one (never 403 —
 * a 403 would confirm the resource exists).
 */
export async function requireOwnedTable(userId: string, tableId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })

  if (!table) {
    throw createError({ statusCode: 404, statusMessage: 'Table not found' })
  }

  return table
}
