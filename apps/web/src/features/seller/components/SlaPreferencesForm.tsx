import type { SellerSettings } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSlaPreferences } from '@/features/seller/api/sellerSettingsActions'

interface SlaPreferencesFormProps {
  sellerId: string
  initial: SellerSettings['slaPreferences'] | undefined
}

export function SlaPreferencesForm({ sellerId, initial }: SlaPreferencesFormProps) {
  const { t } = useTranslation()
  const [acceptWithinHours, setAcceptWithinHours] = useState(initial?.acceptWithinHours ?? 24)
  const [packWithinHours, setPackWithinHours] = useState(initial?.packWithinHours ?? 24)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateSlaPreferences(sellerId, { acceptWithinHours, packWithinHours })
      toast.success(t('sellerSettings.saved'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerSettings.sla.title')}</h2>
      <p className="text-sm text-steel">{t('sellerSettings.sla.description')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acceptWithinHours">{t('sellerSettings.sla.acceptWithinHours')}</Label>
          <Input
            id="acceptWithinHours"
            type="number"
            min={1}
            value={acceptWithinHours}
            onChange={(e) => setAcceptWithinHours(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="packWithinHours">{t('sellerSettings.sla.packWithinHours')}</Label>
          <Input
            id="packWithinHours"
            type="number"
            min={1}
            value={packWithinHours}
            onChange={(e) => setPackWithinHours(Number(e.target.value))}
          />
        </div>
      </div>
      <Button type="button" variant="cta" onClick={handleSave} disabled={saving}>
        {saving ? t('common.loading') : t('sellerSettings.save')}
      </Button>
    </section>
  )
}
