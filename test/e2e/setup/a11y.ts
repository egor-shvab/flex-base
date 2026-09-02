import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * The two machine-checkable halves of `CLAUDE.md` §8, shared by the desktop audit and the mobile
 * shell. Neither replaces a keyboard walk — axe cannot tell whether a focus order makes sense —
 * but both catch what a walk misses precisely because nothing on screen looks different.
 */

/** The WCAG levels the project commits to. Anything outside them is not this gate's business. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Serious and critical only; narrow this to raise the bar. Nothing is disabled today — a rule
 * that ever has to be turned off belongs here with its reason, never at the call site.
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
 * Every interactive element's **effective** target, measured in the page. Three exclusions, each
 * a real SC 2.5.8 exception rather than a convenience:
 *
 * - `.text-link` sits inside a sentence — the *Inline* exception;
 * - an `<input>` wrapped by its own `<label>` is not the target, the label is, so measuring
 *   `BaseCheckbox`'s 20×20 input inside a 36px label reports a failure no user experiences;
 * - anything not rendered — a closed panel's options, the mobile shell's hidden sidebar.
 *
 * The filter chip's remove button is **not** excluded: it sits exactly on the floor, so it is
 * the boundary case that proves the measurement is real.
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
