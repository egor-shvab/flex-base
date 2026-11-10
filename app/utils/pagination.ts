export type TPageCell = number | 'gap'

export function buildPageWindow(page: number, pageCount: number, isCapped: boolean): TPageCell[] {
  const last = isCapped ? Math.max(page, Math.min(page + 1, pageCount)) : Math.max(pageCount, 1)
  const wanted = new Set([1, page - 1, page, page + 1])
  if (!isCapped) wanted.add(last)

  const pages = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)

  const cells: TPageCell[] = []
  for (const n of pages) {
    const previous = cells.at(-1)
    if (typeof previous === 'number' && n - previous === 2) cells.push(previous + 1)
    else if (typeof previous === 'number' && n - previous > 2) cells.push('gap')
    cells.push(n)
  }

  if (isCapped) cells.push('gap')
  return cells
}
