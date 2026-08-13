import type { SubOrder } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'

interface PackingSlipPrintSheetProps {
  subOrders: SubOrder[]
}

/**
 * Print-only packing slips (design item 5: "bulk label printing, packing
 * slip PDF"). No PDF-generation library or Shiprocket label API is wired up
 * in this phase — this renders one slip per selected subOrder and relies on
 * the browser's own "Print to PDF" for the PDF part, which is the
 * lightweight, dependency-free way to get there. Hidden on screen
 * (`hidden print:block`); SellerOrdersPage hides everything else
 * (`print:hidden`) while this is visible, so `window.print()` produces just
 * the slips.
 */
export function PackingSlipPrintSheet({ subOrders }: PackingSlipPrintSheetProps) {
  const { t } = useTranslation()

  return (
    <div className="hidden print:block">
      {subOrders.map((subOrder) => (
        <div key={subOrder.id} className="break-after-page p-8">
          <h2 className="font-heading text-xl font-semibold text-ink">{t('sellerOrders.packingSlip.title')}</h2>
          <p className="mt-1 text-sm text-steel">
            {t('orders.orderId')}: <span className="font-mono text-ink">{subOrder.orderId}</span>
          </p>
          <p className="text-sm text-steel">
            {t('sellerOrders.packingSlip.subOrderId')}: <span className="font-mono text-ink">{subOrder.id}</span>
          </p>

          <div className="mt-4">
            <p className="text-sm font-medium text-ink">{t('sellerOrders.packingSlip.deliverTo')}</p>
            <p className="text-sm text-ink">{subOrder.shippingAddress.contactName}</p>
            <p className="text-sm text-ink">{subOrder.shippingAddress.line1}</p>
            {subOrder.shippingAddress.line2 ? <p className="text-sm text-ink">{subOrder.shippingAddress.line2}</p> : null}
            {subOrder.shippingAddress.landmark ? (
              <p className="text-sm text-ink">{subOrder.shippingAddress.landmark}</p>
            ) : null}
            <p className="text-sm text-ink">
              {subOrder.shippingAddress.city}, {subOrder.shippingAddress.state}{' '}
              <span className="font-mono">{subOrder.shippingAddress.pincode}</span>
            </p>
            <p className="font-mono text-sm text-ink">{subOrder.shippingAddress.contactPhone}</p>
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/30 text-left">
                <th className="py-1">{t('sellerOrders.packingSlip.sku')}</th>
                <th className="py-1">{t('sellerOrders.packingSlip.item')}</th>
                <th className="py-1 text-right">{t('sellerOrders.packingSlip.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {subOrder.items.map((item) => (
                <tr key={item.listingId} className="border-b border-ink/10">
                  <td className="py-1 font-mono">{item.sku}</td>
                  <td className="py-1">{item.title}</td>
                  <td className="py-1 text-right">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
