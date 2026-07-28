/**
 * Delays a call until `delay` ms after the last one — user-driven query inputs must not
 * hit the API on every keystroke.
 */
export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 300,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  return (...args: TArgs) => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => callback(...args), delay)
  }
}
