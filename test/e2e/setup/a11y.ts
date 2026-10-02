import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** A rule that ever has to be turned off belongs here with its reason, never at a call site. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

export async function axeViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

  return violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
    .map((violation) => `${violation.id} (${violation.impact}) × ${violation.nodes.length}`)
}

/**
 * Three exclusions, each a real SC 2.5.8 exception: `.text-link` (Inline), an `<input>` whose
 * wrapping `<label>` is the target, and anything not rendered. The filter chip's remove button is
 * deliberately not excluded: it sits exactly on the floor.
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

export function undersizedTargets(page: Page): Promise<string[]> {
  return page.evaluate<string[]>(UNDERSIZED)
}
