/** Bounds of a numeric range control; `null` means "no bound", never zero. */
export interface INumberRange {
  from: number | null
  to: number | null
}

/** The same, in ISO `YYYY-MM-DD` — what a native date input speaks. */
export interface IDateRange {
  from: string | null
  to: string | null
}
