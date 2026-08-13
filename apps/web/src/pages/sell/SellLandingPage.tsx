import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CommissionPayoutExplainer } from '@/features/sellerOnboarding/components/CommissionPayoutExplainer'
import { SlabPricingExplainer } from '@/features/sellerOnboarding/components/SlabPricingExplainer'

/**
 * Public "Sell on SnapSpare" landing page — written for a shop owner in
 * Aurangabad, not a SaaS buyer: plain language, no jargon, a hi/en toggle
 * right at the top since this is often the very first page such a visitor
 * lands on (unlike the rest of the app, where the toggle lives in account
 * settings once someone's already signed in).
 */
export default function SellLandingPage() {
  const { t, i18n } = useTranslation()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex justify-end gap-1 text-sm">
        <button
          type="button"
          onClick={() => i18n.changeLanguage('en')}
          className={i18n.language === 'en' ? 'font-semibold text-ink' : 'text-steel'}
        >
          English
        </button>
        <span className="text-steel">/</span>
        <button
          type="button"
          onClick={() => i18n.changeLanguage('hi')}
          className={i18n.language === 'hi' ? 'font-semibold text-ink' : 'text-steel'}
        >
          हिन्दी
        </button>
      </div>

      <div className="space-y-3 text-center">
        <h1 className="font-heading text-3xl font-semibold text-ink">{t('sell.landing.heroTitle')}</h1>
        <p className="mx-auto max-w-xl text-base text-steel">{t('sell.landing.heroSubtitle')}</p>
        <Button asChild variant="cta" size="lg">
          <Link to="/sell/apply">{t('sell.landing.cta')}</Link>
        </Button>
      </div>

      <SlabPricingExplainer />
      <CommissionPayoutExplainer />

      <section className="space-y-3 rounded-[6px] border border-steel/20 bg-surface p-5">
        <h2 className="font-heading text-xl font-semibold text-ink">{t('sell.landing.howItWorks.title')}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>{t('sell.landing.howItWorks.step1')}</li>
          <li>{t('sell.landing.howItWorks.step2')}</li>
          <li>{t('sell.landing.howItWorks.step3')}</li>
          <li>{t('sell.landing.howItWorks.step4')}</li>
        </ol>
      </section>

      <div className="text-center">
        <Button asChild variant="cta" size="lg">
          <Link to="/sell/apply">{t('sell.landing.cta')}</Link>
        </Button>
      </div>
    </div>
  )
}
