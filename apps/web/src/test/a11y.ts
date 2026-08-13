import { axe } from 'vitest-axe'
import { expect } from 'vitest'

/**
 * Runs axe-core against a rendered container and fails with the actual
 * violation list (rule id + failure summary) rather than a bare boolean —
 * vitest-axe ships a `toHaveNoViolations` custom matcher for this, but its
 * ambient types target an older Vitest typings shape than the version
 * pinned here (>=2.x), so tsc can't see it. Asserting on the array directly
 * needs no ambient-type workaround and gives the same diagnostic value.
 */
export async function expectNoAxeViolations(container: Element) {
  const results = await axe(container)
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `- [${v.id}] ${v.help} (${v.nodes.length} node(s))`)
      .join('\n')
    expect.fail(`axe found ${results.violations.length} accessibility violation(s):\n${summary}`)
  }
}
