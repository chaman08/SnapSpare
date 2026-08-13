import type { FitmentStatus } from '@snapspare/shared'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFitmentCheck } from '@/features/catalog/api/fitment'
import { expectNoAxeViolations } from '@/test/a11y'
import { useActiveVehicleStore, type ActiveVehicle } from '@/stores/activeVehicleStore'
import { FitmentBadge } from './FitmentBadge'

vi.mock('@/features/catalog/api/fitment', () => ({
  useFitmentCheck: vi.fn(),
}))

const mockUseFitmentCheck = vi.mocked(useFitmentCheck)

const activeVehicle: ActiveVehicle = {
  garageVehicleId: 'gv-1',
  makeId: 'make-1',
  makeName: 'Honda',
  modelId: 'model-1',
  modelName: 'City',
  variantId: 'variant-1',
  variantName: 'VX CVT',
  year: 2020,
  fuelType: 'petrol',
}

function mockFitmentResult(status: FitmentStatus, isFetching = false) {
  mockUseFitmentCheck.mockReturnValue({
    data: { status },
    isFetching,
  } as unknown as ReturnType<typeof useFitmentCheck>)
}

describe('FitmentBadge', () => {
  beforeEach(() => {
    useActiveVehicleStore.setState({ activeVehicle: null })
    mockUseFitmentCheck.mockReset()
  })

  it('renders the FITS state with its accessible text when the active vehicle fits', () => {
    useActiveVehicleStore.setState({ activeVehicle })
    mockFitmentResult('fits')
    render(<FitmentBadge partId="part-1" />)
    expect(screen.getByText('Fits your vehicle')).toBeInTheDocument()
  })

  it('renders the DOES_NOT_FIT state with its accessible text', () => {
    useActiveVehicleStore.setState({ activeVehicle })
    mockFitmentResult('does_not_fit')
    render(<FitmentBadge partId="part-1" />)
    expect(screen.getByText('Does not fit your vehicle')).toBeInTheDocument()
  })

  it('renders the UNVERIFIED state with its accessible text when there is an active vehicle but no result yet', () => {
    useActiveVehicleStore.setState({ activeVehicle })
    mockFitmentResult('unverified')
    render(<FitmentBadge partId="part-1" />)
    expect(screen.getByText('Add your vehicle to check fitment')).toBeInTheDocument()
  })

  it('forces UNVERIFIED when there is no active vehicle, regardless of what the fitment query returns', () => {
    useActiveVehicleStore.setState({ activeVehicle: null })
    mockFitmentResult('fits')
    render(<FitmentBadge partId="part-1" />)
    expect(screen.getByText('Add your vehicle to check fitment')).toBeInTheDocument()
    expect(screen.queryByText('Fits your vehicle')).not.toBeInTheDocument()
  })

  it('marks the badge aria-live="polite" so a status change is announced', () => {
    useActiveVehicleStore.setState({ activeVehicle })
    mockFitmentResult('fits')
    const { container } = render(<FitmentBadge partId="part-1" />)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('renders the "lg" size variant with the same accessible text', () => {
    useActiveVehicleStore.setState({ activeVehicle })
    mockFitmentResult('does_not_fit')
    render(<FitmentBadge partId="part-1" size="lg" />)
    expect(screen.getByText('Does not fit your vehicle')).toBeInTheDocument()
  })

  it.each(['fits', 'does_not_fit', 'unverified'] as const)(
    'has no axe violations in the "%s" state',
    async (status) => {
      useActiveVehicleStore.setState({ activeVehicle })
      mockFitmentResult(status)
      const { container } = render(<FitmentBadge partId="part-1" />)
      await expectNoAxeViolations(container)
    },
  )
})
