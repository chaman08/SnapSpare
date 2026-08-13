import { Mail, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'
import { BusinessHoursCard } from '@/features/support/components/BusinessHoursCard'
import { ContactForm } from '@/features/support/components/ContactForm'
import { WhatsAppSupportButton } from '@/features/support/components/WhatsAppSupportButton'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/**
 * Phase 24 (launch readiness): `/support` — the contact form (ticketed),
 * WhatsApp entry point, business hours, phone/email, and a link to the SLA
 * policy (the Grievance Redressal legal page, which carries the statutory
 * acknowledge/resolve timelines this page's SLA note echoes).
 */
export default function SupportPage() {
  const { t } = useTranslation()
  const { config, loading } = useAppConfig()

  useSeoTags({ title: `${t('support.title')} — SnapSpare`, description: t('support.metaDescription'), path: '/support' })

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('support.title')}</h1>
        <p className="mt-1 text-sm text-steel">{t('support.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-[6px] border border-steel/20 bg-surface p-4">
          <h2 className="font-heading text-base font-semibold text-ink">{t('support.contactForm.title')}</h2>
          <ContactForm />
        </div>

        <div className="space-y-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {config?.supportWhatsappNumber ? <WhatsAppSupportButton whatsappNumber={config.supportWhatsappNumber} /> : null}

              <div className="space-y-2 rounded-[6px] border border-steel/20 bg-surface p-4 text-sm">
                {config?.supportPhone ? (
                  <a href={`tel:${config.supportPhone}`} className="flex items-center gap-2 text-ink hover:text-signal">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span className="font-mono">{config.supportPhone}</span>
                  </a>
                ) : null}
                {config?.supportEmail ? (
                  <a href={`mailto:${config.supportEmail}`} className="flex items-center gap-2 text-ink hover:text-signal">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {config.supportEmail}
                  </a>
                ) : null}
              </div>

              {config?.supportBusinessHours ? <BusinessHoursCard hours={config.supportBusinessHours} /> : null}

              <div className="rounded-[6px] border border-steel/20 bg-surface-muted p-4 text-sm text-ink">
                <p>
                  {t('support.slaNote', { hours: config?.supportTicketSlaHours ?? 48 })}
                </p>
                <Link to="/legal/grievance-redressal" className="mt-1 inline-block font-medium text-signal hover:underline">
                  {t('support.grievanceLink')}
                </Link>
              </div>

              <div className="rounded-[6px] border border-steel/20 bg-surface p-4 text-sm text-ink">
                <Link to="/help" className="font-medium text-signal hover:underline">
                  {t('support.helpCentreLink')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
