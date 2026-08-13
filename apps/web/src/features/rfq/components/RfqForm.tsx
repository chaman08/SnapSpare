import type { CreateRfqResult } from '@snapspare/shared'
import { CATEGORY_TREE, toPaise } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { createRfq, mapRfqErrorToI18nKey } from '@/features/rfq/api/rfqActions'
import { RfqAttachmentUploader } from '@/features/rfq/components/RfqAttachmentUploader'

const formSchema = z.object({
  freeTextDescription: z.string().min(1).max(500).optional(),
  categorySlug: z.string().min(1).optional(),
  qtyRequested: z.coerce.number().int().positive(),
  targetPriceRupees: z.union([z.coerce.number().nonnegative(), z.literal('')]).optional(),
  deliveryPincode: z.string().regex(/^[1-9][0-9]{5}$/),
  requiredByDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
})
type FormValues = z.infer<typeof formSchema>

export interface RfqFormPrefillPart {
  partId: string
  title: string
  categorySlug: string
}

interface RfqFormProps {
  defaultDescription?: string
  defaultCategorySlug?: string
  /**
   * Set only when opened from a product page, where a real catalogue partId
   * already exists — requirement 1's "part from catalogue" path. Every
   * other entry point (zero-result search, /rfq/new) collects free text +
   * category instead; there's no catalogue typeahead in this form itself.
   */
  prefillPart?: RfqFormPrefillPart
  onCreated: (result: CreateRfqResult) => void
}

/** Requirement 1: the one RFQ-creation form shared by all three entry points (zero-result search dialog, product-page "Get a quote" dialog, standalone /rfq/new page). */
export function RfqForm({ defaultDescription, defaultCategorySlug, prefillPart, onCreated }: RfqFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [attachments, setAttachments] = useState<string[]>([])
  const [pathToken] = useState(() => crypto.randomUUID())

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      freeTextDescription: prefillPart ? undefined : (defaultDescription ?? ''),
      categorySlug: prefillPart ? undefined : (defaultCategorySlug ?? CATEGORY_TREE[0]?.slug ?? ''),
      qtyRequested: 100,
      targetPriceRupees: '',
      deliveryPincode: '',
      requiredByDate: '',
      notes: '',
    },
  })

  if (!user) {
    return <p className="text-sm text-steel">{t('rfq.form.signInRequired')}</p>
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await createRfq({
        partId: prefillPart?.partId,
        freeTextDescription: prefillPart ? undefined : values.freeTextDescription,
        categorySlug: prefillPart?.categorySlug ?? values.categorySlug,
        qtyRequested: values.qtyRequested,
        targetPricePaise:
          values.targetPriceRupees !== '' && values.targetPriceRupees !== undefined
            ? toPaise(Number(values.targetPriceRupees))
            : undefined,
        deliveryPincode: values.deliveryPincode,
        requiredByDate: values.requiredByDate ? new Date(values.requiredByDate).getTime() : undefined,
        notes: values.notes || undefined,
        attachments,
      })
      toast.success(
        result.routedSellerCount > 0
          ? t('rfq.form.successRouted', { count: result.routedSellerCount })
          : t('rfq.form.success'),
      )
      onCreated(result)
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {prefillPart ? (
        <div className="rounded-[6px] border border-steel/20 bg-surface-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">{t('rfq.form.partLabel')}</p>
          <p className="font-medium text-ink">{prefillPart.title}</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="rfq-description">{t('rfq.form.description')}</Label>
            <textarea
              id="rfq-description"
              rows={3}
              placeholder={t('rfq.form.descriptionPlaceholder')}
              className="flex w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              {...register('freeTextDescription')}
            />
            {errors.freeTextDescription ? (
              <p role="alert" className="text-sm text-alert">
                {t('rfq.form.descriptionRequired')}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rfq-category">{t('rfq.form.category')}</Label>
            <select
              id="rfq-category"
              {...register('categorySlug')}
              className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {CATEGORY_TREE.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rfq-qty">{t('rfq.form.qty')}</Label>
          <Input id="rfq-qty" type="number" inputMode="numeric" min={1} {...register('qtyRequested')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rfq-targetPrice">{t('rfq.form.targetPrice')}</Label>
          <Input
            id="rfq-targetPrice"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t('rfq.form.targetPricePlaceholder')}
            {...register('targetPriceRupees')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rfq-pincode">{t('rfq.form.deliveryPincode')}</Label>
          <Input id="rfq-pincode" inputMode="numeric" maxLength={6} {...register('deliveryPincode')} />
          {errors.deliveryPincode ? (
            <p role="alert" className="text-sm text-alert">
              {t('rfq.form.pincodeInvalid')}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rfq-requiredBy">{t('rfq.form.requiredByDate')}</Label>
          <Input id="rfq-requiredBy" type="date" {...register('requiredByDate')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rfq-notes">{t('rfq.form.notes')}</Label>
        <textarea
          id="rfq-notes"
          rows={2}
          placeholder={t('rfq.form.notesPlaceholder')}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          {...register('notes')}
        />
      </div>

      <RfqAttachmentUploader buyerUid={user.uid} pathToken={pathToken} images={attachments} onChange={setAttachments} />

      <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('rfq.form.submit')}
      </Button>
    </form>
  )
}
