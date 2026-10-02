const SEARCHABLE_OPTION_THRESHOLD = 8

/**
 * Not for a list that arrives after mount: `searchable` flipping once a fetch lands swaps the
 * focused element out from under the user.
 */
export function shouldSearch(optionCount: number): boolean {
  return optionCount > SEARCHABLE_OPTION_THRESHOLD
}
