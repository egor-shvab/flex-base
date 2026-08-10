import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * The two machine-checkable halves of `CLAUDE.md` §8, shared by the desktop audit and the
 * mobile shell — the second caller is what moved them out of the spec that introduced them.
 *
 * Neither replaces a keyboard walk: axe cannot tell whether a focus order makes sense, and a
 * box measurement cannot tell whether a control is findable. What they catch is the class of
 * regression a human walk misses precisely because nothing on screen looks different.
 */

/** The WCAG levels the project commits to. Anything outside them is not this gate's business. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Serious and critical only. A smoke gate exists to catch regressions, and admitting
 * `moderate`/`minor` on first introduction would have meant either a long disabled-rules list
 * or a stage that never landed — neither of which is a gate. Narrow this to raise the bar.
 *
 * Nothing is disabled today: all five screens pass clean. A rule that ever has to be turned
 * off belongs here with the reason beside it, never silently at the call site.
 */
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

/** Blocking violations as readable one-liners, so a failure names the rule and the count. */
export async function axeViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

  return violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
    .map((violation) => `${violation.id} (${violation.impact}) × ${violation.nodes.length}`)
}

/**
 * Every interactive element's **effective** target, measured in the page. Three exclusions,
 * each a real SC 2.5.8 exception rather than a convenience:
 *
 * - `.text-link` sits inside a sentence — the *Inline* exception. Enlarging it would break the
 *   line box it lives in, which is the reason the exception exists.
 * - An `<input>` wrapped by its own `<label>` is not the target; the label is, and a click
 *   anywhere in it toggles the control. `BaseCheckbox`'s input is 20×20 inside a 36px label,
 *   so measuring the input would report a failure no user can experience.
 * - Anything not rendered — a teleported panel's options while closed, and the mobile shell's
 *   `visibility: hidden` sidebar, which is exactly what that rule is for.
 *
 * The filter-summary chip's remove button is deliberately **not** excluded: it sits exactly on
 * the floor, so it is the boundary case that proves the measurement is real.
 */
const UNDERSIZED = `(() => {
  const FLOOR = 24
  const selector = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="option"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return [...document.querySelectorAll(selector)]
    .filter((element) => !element.closest('.text-link'))
    .map((element) => {
      const label = element.tagName === 'INPUT' ? element.closest('label') : null
      const target = label ?? element
      const styles = getComputedStyle(target)

      return {
        element,
        rect: target.getBoundingClientRect(),
        hidden: styles.visibility === 'hidden' || styles.display === 'none',
      }
    })
    .filter(({ rect, hidden }) => !hidden && rect.width > 0 && rect.height > 0)
    .filter(({ rect }) => rect.width < FLOOR || rect.height < FLOOR)
    .map(({ element, rect }) => {
      const name = (element.getAttribute('aria-label') || element.textContent || '')
        .trim()
        .slice(0, 40)

      return \`\${element.tagName.toLowerCase()} "\${name}" \${Math.round(rect.width)}×\${Math.round(rect.height)}\`
    })
})()`

/** Anything below 24×24, named and measured so a failure is actionable without a screenshot. */
export function undersizedTargets(page: Page): Promise<string[]> {
  return page.evaluate<string[]>(UNDERSIZED)
}
