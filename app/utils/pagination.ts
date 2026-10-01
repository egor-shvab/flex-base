/** One cell of the pager: a page to jump to, or a run of pages it does not draw. */
export type TPageCell = number | 'gap'

/**
 * The page numbers a pager draws: the first, the current one with a neighbour each side, and
 * the last — with a gap wherever a run is skipped. A gap never stands in for a single page;
 * that page is drawn instead, since the cell costs the same and says more.
 *
 * `capped` is a total the server stopped counting at, so `pageCount` is only a floor: the last
 * page is not drawn (it would be a claim the server never made), and a trailing gap says there
 * is more past the window.
 */
export function buildPageWindow(page: number, pageCount: number, capped: boolean): TPageCell[] {
  const last = capped ? Math.max(page, Math.min(page + 1, pageCount)) : Math.max(pageCount, 1)
  const wanted = new Set([1, page - 1, page, page + 1])
  if (!capped) wanted.add(last)

  const pages = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)

  const cells: TPageCell[] = []
  for (const n of pages) {
    const previous = cells.at(-1)
    if (typeof previous === 'number' && n - previous === 2) cells.push(previous + 1)
    else if (typeof previous === 'number' && n - previous > 2) cells.push('gap')
    cells.push(n)
  }

  if (capped) cells.push('gap')
  return cells
}
