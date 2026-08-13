import type { HomeSection } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { VehicleSelector } from '@/features/catalog/components/VehicleSelector'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface VehicleSelectorSectionProps {
  section: Extract<HomeSection, { type: 'vehicle_selector' }>
}

/** Design brief item 1's "Select your vehicle to see parts that fit" entry point — the existing make/model/variant/year picker (VehicleSelector) framed as a homepage hero CTA rather than the compact header trigger it's normally used as. */
export function VehicleSelectorSection({ section }: VehicleSelectorSectionProps) {
  const { t, i18n } = useTranslation()
  const title = pickLocalizedText(section.title, i18n.language) ?? t('home.vehicleSelector.title')
  const subtitle = pickLocalizedText(section.subtitle, i18n.language) ?? t('home.vehicleSelector.subtitle')

  return (
    <section
      aria-label={title}
      className="flex flex-col items-start gap-3 rounded-[6px] border border-steel/20 bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-heading text-lg font-semibold text-ink">{title}</p>
        <p className="text-sm text-steel">{subtitle}</p>
      </div>
      <VehicleSelector />
    </section>
  )
}
