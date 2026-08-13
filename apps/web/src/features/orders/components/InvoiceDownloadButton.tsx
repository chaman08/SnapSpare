import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getInvoiceUrl, mapTaxActionErrorToI18nKey } from '@/features/orders/api/taxActions'

interface InvoiceDownloadButtonProps {
  subOrderId: string
}

/** Mints a fresh signed invoice URL on click and opens it in a new tab — used on both the seller order queue and (once an invoice exists) the buyer order detail page. */
export function InvoiceDownloadButton({ subOrderId }: InvoiceDownloadButtonProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const result = await getInvoiceUrl(subOrderId)
      window.open(result.invoiceUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(t(mapTaxActionErrorToI18nKey(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleClick}>
      {loading ? t('common.loading') : t('orders.tax.downloadInvoice')}
    </Button>
  )
}
