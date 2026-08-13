import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAppConfig } from '@/features/checkout/api/useAppConfig'

const LEGAL_LINKS: { slug: string; labelKey: string }[] = [
  { slug: 'terms-of-use', labelKey: 'footer.legal.termsOfUse' },
  { slug: 'privacy-policy', labelKey: 'footer.legal.privacyPolicy' },
  { slug: 'seller-agreement', labelKey: 'footer.legal.sellerAgreement' },
  { slug: 'return-refund-policy', labelKey: 'footer.legal.returnRefundPolicy' },
  { slug: 'shipping-policy', labelKey: 'footer.legal.shippingPolicy' },
  { slug: 'cancellation-policy', labelKey: 'footer.legal.cancellationPolicy' },
  { slug: 'grievance-redressal', labelKey: 'footer.legal.grievanceRedressal' },
]

/**
 * Phase 24 (launch readiness): adds the legal-page link row, the
 * Grievance Officer summary, and the registered-company disclosure required
 * by the Consumer Protection (E-Commerce) Rules — all reading from
 * config/app (companyLegalName/companyRegisteredAddress/grievanceOfficer,
 * seeded by seedConfig.ts). Renders nothing extra when config/app isn't
 * loaded yet or fields are unset, so this never blocks the rest of the page.
 */
export function Footer() {
  const { t } = useTranslation()
  const { config } = useAppConfig()

  return (
    <footer className="hidden border-t bg-surface-muted px-4 py-8 text-sm text-steel md:block">
      <div className="mx-auto max-w-6xl space-y-4">
        <nav aria-label={t('footer.legal.navLabel')} className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.slug} to={`/legal/${link.slug}`} className="hover:text-ink hover:underline">
              {t(link.labelKey)}
            </Link>
          ))}
          <Link to="/help" className="hover:text-ink hover:underline">
            {t('footer.helpCentre')}
          </Link>
          <Link to="/support" className="hover:text-ink hover:underline">
            {t('footer.contactSupport')}
          </Link>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} {t('app.name')}
          </p>
          <Link to="/sell" className="font-medium text-ink hover:text-signal">
            {t('sell.landing.footerLink')}
          </Link>
        </div>

        {config?.companyLegalName || config?.grievanceOfficer ? (
          <div className="space-y-1 border-t border-steel/10 pt-3 text-xs text-steel">
            {config.companyLegalName ? (
              <p>
                {t('footer.operatedBy', { name: config.companyLegalName })}
                {config.companyRegisteredAddress ? ` — ${config.companyRegisteredAddress}` : ''}
              </p>
            ) : null}
            {config.grievanceOfficer ? (
              <p>
                {t('footer.grievanceOfficer', { name: config.grievanceOfficer.name })}{' '}
                <a href={`mailto:${config.grievanceOfficer.email}`} className="hover:text-ink hover:underline">
                  {config.grievanceOfficer.email}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
