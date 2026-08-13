import type { ListingPricing } from '@snapspare/shared'
import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '@/test/a11y'
import { PriceLadder } from './PriceLadder'

const pricing: ListingPricing = {
  moq: 1,
  stepQty: 1,
  tiers: [
    { minQty: 1, maxQty: 9, unitPricePaise: 25000 },
    { minQty: 10, maxQty: 49, unitPricePaise: 19500 },
    { minQty: 50, maxQty: null, unitPricePaise: 14500 },
  ],
}

function renderLadder(overrides: Partial<ComponentProps<typeof PriceLadder>> = {}) {
  return render(
    <MemoryRouter>
      <PriceLadder
        pricing={pricing}
        qty={1}
        onSelectQty={() => {}}
        gstRatePercent={18}
        taxIncluded={false}
        gstDisplayMode="exclusive"
        {...overrides}
      />
    </MemoryRouter>,
  )
}

describe('PriceLadder accessibility', () => {
  it('has no axe violations for a retail (locked) buyer', async () => {
    const { container } = renderLadder()
    await expectNoAxeViolations(container)
  })

  it('has no axe violations for a business buyer with the full ladder unlocked', async () => {
    const { container } = renderLadder({ buyerType: 'garage', qty: 10 })
    await expectNoAxeViolations(container)
  })

  it('exposes every tier to screen readers via the accessible table, independent of the decorative bar', () => {
    const { getByRole } = renderLadder({ buyerType: 'garage', qty: 10 })
    const table = getByRole('table', { hidden: true })
    // 3 tiers + 1 header row.
    expect(table.querySelectorAll('tr')).toHaveLength(4)
  })

  it('removes the decorative bar buttons from tab order so they are not announced as unlabelled controls', () => {
    const { container } = renderLadder({ buyerType: 'garage', qty: 10 })
    const decorativeBar = container.querySelector('[aria-hidden="true"]')
    expect(decorativeBar).not.toBeNull()
    const focusable = decorativeBar!.querySelectorAll('button, a')
    focusable.forEach((el) => expect(el).toHaveAttribute('tabindex', '-1'))
  })
})
