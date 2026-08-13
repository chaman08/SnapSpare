import type { PriceCartResult, PricedSellerGroup } from '@snapspare/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '@/test/a11y'
import { CheckoutOrderSummary } from './CheckoutOrderSummary'

function makeSellerGroup(overrides: Partial<PricedSellerGroup> = {}): PricedSellerGroup {
  return {
    sellerId: 'seller-1',
    sellerName: 'Acme Auto Parts',
    sellerRatingAvg: 4.5,
    sellerRatingCount: 120,
    items: [
      {
        listingId: 'listing-1',
        partId: 'part-1',
        sellerId: 'seller-1',
        sku: 'SKU-1',
        title: 'Brake Pad Set',
        qty: 2,
        unitPricePaise: 25000,
        tierMinQtyApplied: 1,
        hsnCode: '87083000',
        gstRatePercent: 18,
        lineSubtotalPaise: 50000,
        lineDiscountPaise: 0,
        lineTaxPaise: 9000,
        lineTotalPaise: 59000,
        warnings: [],
      },
    ],
    subtotalPaise: 50000,
    discountPaise: 0,
    taxableValuePaise: 54900,
    isInterState: false,
    cgstPaise: 4500,
    sgstPaise: 4500,
    igstPaise: 0,
    taxPaise: 9000,
    shippingPaise: 4900,
    freeShippingRemainingPaise: 0,
    viaSurfaceTransport: false,
    codRestricted: false,
    totalPaise: 63900,
    ...overrides,
  }
}

function makeResult(overrides: Partial<PriceCartResult> = {}): PriceCartResult {
  const sellerGroups = overrides.sellerGroups ?? [makeSellerGroup()]
  return {
    sellerGroups,
    unavailableListingIds: [],
    subtotalPaise: 50000,
    discountPaise: 0,
    shippingPaise: 4900,
    taxableValuePaise: 54900,
    cgstPaise: 4500,
    sgstPaise: 4500,
    igstPaise: 0,
    taxPaise: 9000,
    totalPaise: 63900,
    freeShippingThresholdPaise: 100000,
    notices: [],
    pricedAt: Date.now(),
    ...overrides,
  }
}

const noop = () => {}

describe('CheckoutOrderSummary', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <CheckoutOrderSummary result={makeResult()} codFeePaise={0} onPlaceOrder={noop} placing={false} disabled={false} />,
    )
    await expectNoAxeViolations(container)
  })

  it('renders subtotal, taxable value and the base total when there is no COD fee', () => {
    render(
      <CheckoutOrderSummary result={makeResult()} codFeePaise={0} onPlaceOrder={noop} placing={false} disabled={false} />,
    )
    expect(screen.getByText('₹500')).toBeInTheDocument() // subtotal
    expect(screen.getByText('₹549')).toBeInTheDocument() // taxable value
    expect(screen.getByText('₹639')).toBeInTheDocument() // total = 63900 + 0
    expect(screen.queryByText('Cash on Delivery')).not.toBeInTheDocument()
  })

  it('adds the disclosed COD fee to the grand total and shows the COD line when codFeePaise > 0', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult()}
        codFeePaise={2000}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument()
    expect(screen.getByText('₹20')).toBeInTheDocument() // COD fee line
    expect(screen.getByText('₹659')).toBeInTheDocument() // total = 63900 + 2000 = 65900 paise
  })

  it('renders the discount line only when discountPaise is greater than zero', () => {
    const { rerender } = render(
      <CheckoutOrderSummary
        result={makeResult({ discountPaise: 0 })}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.queryByText('Discount')).not.toBeInTheDocument()

    rerender(
      <CheckoutOrderSummary
        result={makeResult({ discountPaise: 5000 })}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.getByText('Discount')).toBeInTheDocument()
    expect(screen.getByText('-₹50')).toBeInTheDocument()
  })

  it('renders "Free" instead of ₹0 for free shipping', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult({ shippingPaise: 0 })}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('renders CGST and SGST but not IGST for an intra-state order', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult({ cgstPaise: 4500, sgstPaise: 4500, igstPaise: 0 })}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.getByText('CGST')).toBeInTheDocument()
    expect(screen.getByText('SGST')).toBeInTheDocument()
    expect(screen.queryByText('IGST')).not.toBeInTheDocument()
  })

  it('renders IGST but not CGST/SGST for an inter-state order', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult({ cgstPaise: 0, sgstPaise: 0, igstPaise: 9000 })}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={false}
      />,
    )
    expect(screen.getByText('IGST')).toBeInTheDocument()
    expect(screen.queryByText('CGST')).not.toBeInTheDocument()
    expect(screen.queryByText('SGST')).not.toBeInTheDocument()
  })

  it('calls onPlaceOrder when the place order button is clicked', () => {
    const onPlaceOrder = vi.fn()
    render(
      <CheckoutOrderSummary
        result={makeResult()}
        codFeePaise={0}
        onPlaceOrder={onPlaceOrder}
        placing={false}
        disabled={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    expect(onPlaceOrder).toHaveBeenCalledTimes(1)
  })

  it('disables the button and shows a loading label while placing', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult()}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={true}
        disabled={false}
      />,
    )
    const button = screen.getByRole('button', { name: 'Loading…' })
    expect(button).toBeDisabled()
  })

  it('disables the button when disabled is true even if not placing', () => {
    render(
      <CheckoutOrderSummary
        result={makeResult()}
        codFeePaise={0}
        onPlaceOrder={noop}
        placing={false}
        disabled={true}
      />,
    )
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
  })
})
