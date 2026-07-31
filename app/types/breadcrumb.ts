/** One crumb. A missing `to` marks the current page — the last item never links. */
export interface IBreadcrumb {
  label: string
  to?: string
}
