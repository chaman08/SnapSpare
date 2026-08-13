import type { HomeSection, HomeSectionTrustIcon } from '@snapspare/shared'
import { Banknote, FileCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { pickLocalizedText } from '@/features/home/lib/localizedText'

interface TrustStripSectionProps {
  section: Extract<HomeSection, { type: 'trust_strip' }>
}

const ICONS: Record<HomeSectionTrustIcon, typeof ShieldCheck> = {
  'shield-check': ShieldCheck,
  'file-check': FileCheck,
  'rotate-ccw': RotateCcw,
  banknote: Banknote,
}

/** Design brief item 1's trust strip — genuine parts / GST invoice / easy returns / COD, admin-editable. */
export function TrustStripSection({ section }: TrustStripSectionProps) {
  const { i18n } = useTranslation()

  return (
    <section
      aria-label="trust"
      className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 bg-surface p-4 sm:grid-cols-4"
    >
      {section.items.map((item, index) => {
        const Icon = ICONS[item.icon]
        return (
          <div key={index} className="flex items-center gap-2">
            <Icon className="h-5 w-5 shrink-0 text-verify" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">{pickLocalizedText(item.label, i18n.language)}</span>
          </div>
        )
      })}
    </section>
  )
}
