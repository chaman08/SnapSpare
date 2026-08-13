import type { PriceCartResult, PricedSellerGroup } from '@snapspare/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '@/test/a11y'
import { OrderSummary } from './OrderSummary'

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
    taxableValuePaise: 50000,
    isInterState: false,
    cgstPaise: 4500,
    sgstPaise: 4500,
    igstPaise: 0,
    taxPaise: 9000,
    shippingPaise: 0,
    freeShippingRemainingPaise: 0,
    viaSurfaceTransport: false,
    codRestricted: false,
    totalPaise: 59000,
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

describe('OrderSummary', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <OrderSummary result={makeResult()} onCheckout={() => {}} />,
    )
    await expectNoAxeViolations(container)
  })

  it('renders the subtotal, taxable value and total straight off the priced result', () => {
    render(<OrderSummary result={makeResult()} onCheckout={() => {}} />)
    expect(screen.getByText('₹500')).toBeInTheDocument() // subtotal 50000 paise
    expect(screen.getByText('₹549')).toBeInTheDocument() // taxable value 54900 paise
    expect(screen.getByText('₹639')).toBeInTheDocument() // total 63900 paise
  })

  it('renders single-seller shipping as one line when there is only one seller group', () => {
    render(<OrderSummary result={makeResult({ shippingPaise: 4900 })} onCheckout={() => {}} />)
    expect(screen.getByText('Shipping')).toBeInTheDocument()
    expect(screen.getByText('₹49')).toBeInTheDocument()
    expect(screen.queryByText(/Shipping — /)).not.toBeInTheDocument()
  })

  it('renders "Free" instead of ₹0 for free single-seller shipping', () => {
    render(<OrderSummary result={makeResult({ shippingPaise: 0 })} onCheckout={() => {}} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('renders a per-seller shipping breakdown when the cart spans multiple sellers', () => {
    const sellerGroups = [
      makeSellerGroup({ sellerId: 'seller-1', sellerName: 'Acme Auto Parts', shippingPaise: 4900 }),
      makeSellerGroup({ sellerId: 'seller-2', sellerName: 'Speedy Spares', shippingPaise: 0 }),
    ]
    render(<OrderSummary result={makeResult({ sellerGroups })} onCheckout={() => {}} />)
    expect(screen.getByText('Shipping — Acme Auto Parts')).toBeInTheDocument()
    expect(screen.getByText('Shipping — Speedy Spares')).toBeInTheDocument()
    expect(screen.getByText('₹49')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.queryByText('Shipping')).not.toBeInTheDocument()
  })

  it('renders the discount line only when discountPaise is greater than zero', () => {
    const { rerender } = render(
      <OrderSummary result={makeResult({ discountPaise: 0 })} onCheckout={() => {}} />,
    )
    expect(screen.queryByText('Discount')).not.toBeInTheDocument()

    rerender(<OrderSummary result={makeResult({ discountPaise: 5000 })} onCheckout={() => {}} />)
    expect(screen.getByText('Discount')).toBeInTheDocument()
    expect(screen.getByText('-₹50')).toBeInTheDocument()
  })

  it('renders CGST and SGST but not IGST for an intra-state order', () => {
    render(
      <OrderSummary
        result={makeResult({ cgstPaise: 4500, sgstPaise: 4500, igstPaise: 0 })}
        onCheckout={() => {}}
      />,
    )
    expect(screen.getByText('CGST')).toBeInTheDocument()
    expect(screen.getByText('SGST')).toBeInTheDocument()
    expect(screen.queryByText('IGST')).not.toBeInTheDocument()
  })

  it('renders IGST but not CGST/SGST for an inter-state order', () => {
    render(
      <OrderSummary
        result={makeResult({ cgstPaise: 0, sgstPaise: 0, igstPaise: 9000 })}
        onCheckout={() => {}}
      />,
    )
    expect(screen.getByText('IGST')).toBeInTheDocument()
    expect(screen.queryByText('CGST')).not.toBeInTheDocument()
    expect(screen.queryByText('SGST')).not.toBeInTheDocument()
  })

  it('shows the missing-shipping-address notice only when that notice code is present', () => {
    const { rerender } = render(<OrderSummary result={makeResult({ notices: [] })} onCheckout={() => {}} />)
    expect(
      screen.queryByText('Add a delivery address to see accurate shipping and tax.'),
    ).not.toBeInTheDocument()

    rerender(
      <OrderSummary
        result={makeResult({ notices: [{ code: 'no_shipping_address' }] })}
        onCheckout={() => {}}
      />,
    )
    expect(
      screen.getByText('Add a delivery address to see accurate shipping and tax.'),
    ).toBeInTheDocument()
  })

  it('calls onCheckout when the checkout button is clicked', () => {
    const onCheckout = vi.fn()
    render(<OrderSummary result={makeResult()} onCheckout={onCheckout} />)
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }))
    expect(onCheckout).toHaveBeenCalledTimes(1)
  })

  it('disables the checkout button when checkoutDisabled is true', () => {
    render(<OrderSummary result={makeResult()} onCheckout={() => {}} checkoutDisabled />)
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled()
  })
})
