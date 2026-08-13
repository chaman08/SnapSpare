import type { GroupPricing, GstRatePercent, Listing, PartCondition, SaveListingRequest } from '@snapspare/shared'
import { toPaise } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { setListingCostPrice } from '@/features/seller-listings/api/costPrice'
import { saveListing, updateListingStatus } from '@/features/seller-listings/api/saveListing'
import { BuyerGroupPricingTabs } from '@/features/seller-listings/components/BuyerGroupPricingTabs'
import { ImageUploader } from '@/features/seller-listings/components/ImageUploader'
import { MarginCalculator } from '@/features/seller-listings/components/MarginCalculator'
import { PriceLadderPreview } from '@/features/seller-listings/components/PriceLadderPreview'
import { PricingTemplatePicker } from '@/features/seller-listings/components/PricingTemplatePicker'
import { type SlabPricingValue, SlabPricingEditor } from '@/features/seller-listings/components/SlabPricingEditor'

const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28]
const CONDITIONS: PartCondition[] = ['new', 'used', 'refurbished']

const formSchema = z.object({
  sku: z.string().min(1),
  condition: z.enum(['new', 'used', 'refurbished']),
  stockQty: z.coerce.number().int().nonnegative(),
  mrpRupees: z.coerce.number().nonnegative().optional().or(z.literal('')),
  taxIncluded: z.boolean(),
  hsnCode: z.string().min(4),
  gstRatePercent: z.coerce.number(),
  weightGrams: z.coerce.number().int().positive().optional().or(z.literal('')),
  warrantyMonths: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  packLabel: z.string().optional(),
  returnWindowDays: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  isOversized: z.boolean(),
})
type FormValues = z.infer<typeof formSchema>

/** Structural subset shared by `SearchCatalogPartDocument` (from the typeahead) and `CatalogPart` (fetched by id when editing) — everything this form prefills from and never re-collects. */
export interface CatalogPartLike {
  id: string
  partNumber: string
  name: string
  brand?: string
  hsnCode: string
  gstRatePercent: number
  imageUrl?: string
  categorySlug: string
}

interface ListingCommercialFormProps {
  sellerId: string
  catalogPart: CatalogPartLike
  existingListing?: Listing
  onSaved: (listingId: string) => void
}

/**
 * Commercial-fields-only form — the part's own specs (name, brand, fitment)
 * come from the catalogue and aren't editable here, per requirement 1's
 * "keeps the catalogue clean" rationale. The quantity-slab ladder is edited
 * via `SlabPricingEditor` (kept outside RHF's own field-tracking since it
 * manages its own drag/derive logic — see that component's header comment)
 * with `PriceLadderPreview` alongside it showing the buyer's view live.
 */
export function ListingCommercialForm({ sellerId, catalogPart, existingListing, onSaved }: ListingCommercialFormProps) {
  const { t } = useTranslation()
  const [images, setImages] = useState<string[]>(existingListing?.images ?? [])
  const [pathToken] = useState(() => existingListing?.id ?? crypto.randomUUID())
  const [pricing, setPricing] = useState<SlabPricingValue>(
    existingListing?.pricing ?? { moq: 1, stepQty: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 0 }] },
  )
  const [pricingValid, setPricingValid] = useState(Boolean(existingListing))
  const [groupPricing, setGroupPricing] = useState<GroupPricing | undefined>(existingListing?.groupPricing)
  const [groupPricingValid, setGroupPricingValid] = useState(true)
  const [costPricePaise, setCostPricePaise] = useState<number | undefined>(undefined)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: existingListing?.sku ?? catalogPart.partNumber,
      condition: existingListing?.condition ?? 'new',
      stockQty: existingListing?.stockQty ?? 0,
      mrpRupees: existingListing?.mrpPaise !== undefined ? existingListing.mrpPaise / 100 : '',
      taxIncluded: existingListing?.taxIncluded ?? true,
      hsnCode: existingListing?.hsnCode ?? catalogPart.hsnCode,
      gstRatePercent: existingListing?.gstRatePercent ?? catalogPart.gstRatePercent,
      weightGrams: existingListing?.weightGrams ?? '',
      warrantyMonths: existingListing?.warrantyMonths ?? '',
      packLabel: existingListing?.packLabel ?? '',
      returnWindowDays: existingListing?.returnWindowDays ?? '',
      isOversized: existingListing?.isOversized ?? false,
    },
  })

  const condition = watch('condition')
  const taxIncluded = watch('taxIncluded')
  const isOversized = watch('isOversized')
  const gstRatePercent = watch('gstRatePercent')
  const weightGrams = watch('weightGrams')
  const conditionId = useId()

  function buildRequest(values: FormValues): SaveListingRequest {
    return {
      id: existingListing?.id,
      partId: catalogPart.id,
      sku: values.sku,
      title: catalogPart.name,
      condition: values.condition,
      stockQty: values.stockQty,
      pricing,
      groupPricing,
      mrpPaise: values.mrpRupees === '' || values.mrpRupees === undefined ? undefined : toPaise(values.mrpRupees),
      taxIncluded: values.taxIncluded,
      hsnCode: values.hsnCode,
      gstRatePercent: values.gstRatePercent as GstRatePercent,
      weightGrams: values.weightGrams === '' || values.weightGrams === undefined ? undefined : values.weightGrams,
      isOversized: values.isOversized,
      isFeatured: existingListing?.isFeatured ?? false,
      images,
      warrantyMonths: values.warrantyMonths === '' || values.warrantyMonths === undefined ? undefined : values.warrantyMonths,
      packLabel: values.packLabel || undefined,
      returnWindowDays:
        values.returnWindowDays === '' || values.returnWindowDays === undefined ? undefined : values.returnWindowDays,
    }
  }

  async function persist(values: FormValues, publish: boolean) {
    try {
      const result = await saveListing(buildRequest(values))
      if (costPricePaise !== undefined) {
        await setListingCostPrice(result.id, costPricePaise)
      }
      if (publish) {
        await updateListingStatus({ id: result.id, status: 'active' })
      }
      toast.success(t('sellerListings.addFlow.saveSuccess'))
      onSaved(result.id)
    } catch (error) {
      const message = (error as { message?: string } | null)?.message ?? ''
      if (message === 'cannot_activate_out_of_stock') {
        toast.error(t('sellerListings.addFlow.publishBlockedOutOfStock'))
        return
      }
      toast.error(t('sellerListings.addFlow.saveError'))
    }
  }

  const submitDraft = handleSubmit((values) => persist(values, false))
  const submitAndPublish = handleSubmit((values) => persist(values, true))
  const overallPricingValid = pricingValid && groupPricingValid

  // SlabPricingEditor only reads its `value` prop once, on mount (it owns
  // its own draft-row/drag state after that — see that component's header
  // comment). Applying a template overwrites `pricing`/`groupPricing` from
  // outside the normal edit flow, so the editor(s) need to be force-
  // remounted to pick up the new values — bumping this key does that
  // (threaded into BuyerGroupPricingTabs too, so an existing group
  // override's editor remounts the same way).
  const [pricingResetKey, setPricingResetKey] = useState(0)

  function handleApplyTemplate(templatePricing: SlabPricingValue, templateGroupPricing: GroupPricing | undefined) {
    setPricing(templatePricing)
    setGroupPricing(templateGroupPricing)
    setPricingResetKey((key) => key + 1)
  }

  return (
    <form onSubmit={submitDraft} className="space-y-5" noValidate>
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerListings.addFlow.step2Title')}</h2>
        <p className="text-sm text-steel">{t('sellerListings.addFlow.step2Description')}</p>
        <div className="mt-2 flex items-center gap-2 rounded-[6px] border border-steel/20 p-2 text-sm">
          {catalogPart.imageUrl ? (
            <img src={catalogPart.imageUrl} alt="" className="h-10 w-10 rounded-[6px] object-cover" />
          ) : null}
          <div>
            <p className="font-medium text-ink">{catalogPart.name}</p>
            <p className="font-mono text-xs text-steel">{catalogPart.partNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sku">{t('sellerListings.addFlow.skuLabel')}</Label>
          <Input id="sku" className="font-mono" {...register('sku')} />
          {errors.sku ? <p role="alert" className="text-sm text-alert">{errors.sku.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stockQty">{t('sellerListings.addFlow.stockQtyLabel')}</Label>
          <Input id="stockQty" type="number" min={0} inputMode="numeric" {...register('stockQty')} />
          {errors.stockQty ? <p role="alert" className="text-sm text-alert">{errors.stockQty.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label id={`${conditionId}-label`}>{t('sellerListings.addFlow.conditionLabel')}</Label>
        <RadioGroup
          name="condition"
          value={condition}
          onValueChange={(v) => setValue('condition', v as PartCondition, { shouldValidate: true })}
          aria-label={t('sellerListings.addFlow.conditionLabel')}
          className="grid grid-cols-3 gap-2"
        >
          {CONDITIONS.map((c) => (
            <RadioGroupItem key={c} value={c}>
              {t(`sellerListings.condition.${c}`)}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mrpRupees">{t('sellerListings.addFlow.mrpLabel')}</Label>
        <Input id="mrpRupees" type="number" min={0} step="0.01" inputMode="decimal" className="max-w-xs" {...register('mrpRupees')} />
      </div>

      <div className="space-y-2 border-t border-steel/10 pt-4">
        <h3 className="font-heading text-base font-semibold text-ink">{t('sellerListings.pricingEditor.title')}</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SlabPricingEditor key={pricingResetKey} value={pricing} onChange={setPricing} onValidityChange={setPricingValid} />
          <PriceLadderPreview pricing={pricing} />
        </div>
        <MarginCalculator
          listingId={existingListing?.id}
          categorySlug={catalogPart.categorySlug}
          pricing={pricing}
          gstRatePercent={Number(gstRatePercent)}
          taxIncluded={taxIncluded}
          weightGrams={typeof weightGrams === 'number' ? weightGrams : undefined}
          isOversized={isOversized}
          onCostPriceChange={setCostPricePaise}
        />
        <PricingTemplatePicker
          sellerId={sellerId}
          currentPricing={pricing}
          currentPricingValid={pricingValid}
          currentGroupPricing={groupPricing}
          onApply={handleApplyTemplate}
        />
      </div>

      <div className="space-y-2 border-t border-steel/10 pt-4">
        <h3 className="font-heading text-base font-semibold text-ink">{t('sellerListings.buyerGroups.title')}</h3>
        <p className="text-sm text-steel">{t('sellerListings.buyerGroups.description')}</p>
        <BuyerGroupPricingTabs
          key={pricingResetKey}
          defaultPricing={pricing}
          groupPricing={groupPricing}
          onChange={setGroupPricing}
          onValidityChange={setGroupPricingValid}
        />
      </div>

      <label className="flex min-h-tap items-center gap-2 text-sm text-ink">
        <Checkbox checked={taxIncluded} onChange={(e) => setValue('taxIncluded', e.target.checked)} />
        {t('sellerListings.addFlow.taxIncludedLabel')}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hsnCode">{t('sellerListings.addFlow.hsnCodeLabel')}</Label>
          <Input id="hsnCode" className="font-mono" {...register('hsnCode')} />
          {errors.hsnCode ? <p role="alert" className="text-sm text-alert">{errors.hsnCode.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gstRatePercent">{t('sellerListings.addFlow.gstRateLabel')}</Label>
          <select
            id="gstRatePercent"
            {...register('gstRatePercent')}
            className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {GST_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="weightGrams">{t('sellerListings.addFlow.weightLabel')}</Label>
          <Input id="weightGrams" type="number" min={0} inputMode="numeric" {...register('weightGrams')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warrantyMonths">{t('sellerListings.addFlow.warrantyLabel')}</Label>
          <Input id="warrantyMonths" type="number" min={0} inputMode="numeric" {...register('warrantyMonths')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="returnWindowDays">{t('sellerListings.addFlow.returnWindowLabel')}</Label>
          <Input id="returnWindowDays" type="number" min={0} inputMode="numeric" {...register('returnWindowDays')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="packLabel">{t('sellerListings.addFlow.packLabelLabel')}</Label>
        <Input id="packLabel" {...register('packLabel')} />
      </div>

      <label className="flex min-h-tap items-center gap-2 text-sm text-ink">
        <Checkbox checked={isOversized} onChange={(e) => setValue('isOversized', e.target.checked)} />
        {t('sellerListings.addFlow.oversizedLabel')}
      </label>

      <ImageUploader sellerId={sellerId} pathToken={pathToken} images={images} onChange={setImages} />

      <div className="flex flex-wrap gap-2 border-t border-steel/10 pt-4">
        <Button type="submit" variant="outline" disabled={isSubmitting || !overallPricingValid}>
          {t('sellerListings.addFlow.saveDraft')}
        </Button>
        <Button type="button" variant="cta" disabled={isSubmitting || !overallPricingValid} onClick={submitAndPublish}>
          {t('sellerListings.addFlow.publish')}
        </Button>
        {!overallPricingValid ? (
          <p role="alert" className="w-full text-sm text-alert">
            {t('sellerListings.pricingEditor.fixErrorsBeforeSave')}
          </p>
        ) : null}
      </div>
    </form>
  )
}
