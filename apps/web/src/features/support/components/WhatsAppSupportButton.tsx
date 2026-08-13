import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Phase 24: `wa.me` deep link using config/app.supportWhatsappNumber — opens WhatsApp (app or web) with a prefilled greeting, no in-app chat UI to build/maintain. */
export function WhatsAppSupportButton({ whatsappNumber }: { whatsappNumber: string }) {
  const { t } = useTranslation()
  const digitsOnly = whatsappNumber.replace(/[^\d]/g, '')
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(t('support.whatsapp.prefilledMessage'))}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-tap items-center justify-center gap-2 rounded-[6px] border border-verify/40 bg-verify/5 px-4 py-3 text-sm font-medium text-verify hover:bg-verify/10"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {t('support.whatsapp.cta')}
    </a>
  )
}
