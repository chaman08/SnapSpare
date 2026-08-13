import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'

interface NeedHelpButtonProps {
  orderId: string
  subOrderId?: string
}

/**
 * "Need help?" (design item 4): opens a WhatsApp chat to the platform's
 * support number, prefilled with the order (and, if given, subOrder)
 * context — the stack's own choice of support channel (WhatsApp Cloud API,
 * see project conventions) rather than a bespoke in-app ticketing system,
 * which doesn't exist yet (see this PR's "left out" notes).
 */
export function NeedHelpButton({ orderId, subOrderId }: NeedHelpButtonProps) {
  const { t } = useTranslation()
  const { config } = useAppConfig()

  function handleClick() {
    const message = t('orders.help.prefilledMessage', {
      orderId,
      subOrderId: subOrderId ?? '—',
    })
    const phone = config?.supportPhone?.replace(/[^\d]/g, '')
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    } else if (config?.supportEmail) {
      window.open(`mailto:${config.supportEmail}?subject=${encodeURIComponent(message)}`, '_blank')
    }
  }

  if (!config?.supportPhone && !config?.supportEmail) return null

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick}>
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
      {t('orders.help.needHelp')}
    </Button>
  )
}
