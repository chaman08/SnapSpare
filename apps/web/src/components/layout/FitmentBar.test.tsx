import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '@/test/a11y'
import { FitmentBar } from './FitmentBar'

describe('FitmentBar accessibility', () => {
  it.each(['fits', 'does_not_fit', 'unverified'] as const)(
    'has no axe violations in the "%s" state',
    async (status) => {
      const { container } = render(<FitmentBar status={status} onClick={() => {}} />)
      await expectNoAxeViolations(container)
    },
  )

  it('exposes the fitment status as the accessible name of the control', () => {
    const { getByRole } = render(<FitmentBar status="fits" onClick={() => {}} />)
    // The status text (not just an icon) is what a screen reader announces —
    // this is the "screen-reader label" the persistent fitment bar promises.
    expect(getByRole('button')).toHaveAccessibleName(/fits your vehicle/i)
  })
})
