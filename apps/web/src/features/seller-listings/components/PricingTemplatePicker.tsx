import type { GroupPricing } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSellerPricingTemplates } from '@/features/seller-listings/api/useSellerPricingTemplates'
import { deletePricingTemplate, savePricingTemplate } from '@/features/seller-listings/api/pricingTemplates'
import type { SlabPricingValue } from '@/features/seller-listings/components/SlabPricingEditor'

interface PricingTemplatePickerProps {
  sellerId: string
  currentPricing: SlabPricingValue
  currentPricingValid: boolean
  currentGroupPricing?: GroupPricing
  onApply: (pricing: SlabPricingValue, groupPricing: GroupPricing | undefined) => void
}

/**
 * Save the current ladder shape (+ any buyer-group overrides) as a reusable
 * template, or load a previously-saved one back onto this listing.
 * Applying a template to *many* listings at once (requirement 3d's "apply
 * it to many listings at once") is the bulk-select toolbar's job — see
 * BulkActionsToolbar.tsx — this widget only ever touches the listing
 * currently open in the editor.
 */
export function PricingTemplatePicker({
  sellerId,
  currentPricing,
  currentPricingValid,
  currentGroupPricing,
  onApply,
}: PricingTemplatePickerProps) {
  const { t } = useTranslation()
  const templatesQuery = useSellerPricingTemplates(sellerId)
  const [savingName, setSavingName] = useState<string | null>(null)
  const [nameText, setNameText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (!nameText.trim()) return
    setBusy(true)
    try {
      await savePricingTemplate({
        name: nameText.trim(),
        pricing: currentPricing,
        groupPricing: currentGroupPricing,
      })
      toast.success(t('sellerListings.templates.saved'))
      setSavingName(null)
      setNameText('')
      await templatesQuery.refetch()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    try {
      await deletePricingTemplate(id)
      await templatesQuery.refetch()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 p-3">
      <p className="font-heading text-sm font-semibold text-ink">{t('sellerListings.templates.title')}</p>

      {templatesQuery.data && templatesQuery.data.length > 0 ? (
        <ul className="space-y-1.5">
          {templatesQuery.data.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-2 rounded-[6px] border border-steel/10 p-2">
              <span className="text-sm text-ink">{template.name}</span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onApply({ moq: template.pricing.moq, stepQty: template.pricing.stepQty, tiers: template.pricing.tiers }, template.groupPricing)
                  }
                >
                  {t('sellerListings.templates.apply')}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => handleDelete(template.id)}>
                  {t('sellerListings.templates.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-steel">{t('sellerListings.templates.empty')}</p>
      )}

      {savingName === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!currentPricingValid}
          onClick={() => setSavingName('')}
        >
          {t('sellerListings.templates.saveCurrent')}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={nameText}
            onChange={(e) => setNameText(e.target.value)}
            placeholder={t('sellerListings.templates.namePlaceholder')}
            className="max-w-xs"
          />
          <Button type="button" variant="cta" size="sm" disabled={busy || !nameText.trim()} onClick={handleSave}>
            {t('sellerListings.templates.save')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSavingName(null)}>
            {t('common.close')}
          </Button>
        </div>
      )}
      {!currentPricingValid && savingName === null ? (
        <p className="text-xs text-steel">{t('sellerListings.templates.fixErrorsToSave')}</p>
      ) : null}
    </div>
  )
}
