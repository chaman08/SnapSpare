import type { PartType } from '@snapspare/shared'
import { CATEGORY_TREE } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitPartRequest } from '@/features/seller-listings/api/partRequests'
import { ImageUploader } from '@/features/seller-listings/components/ImageUploader'

const PART_TYPES: PartType[] = ['oem', 'oes', 'aftermarket', 'genuine']

const formSchema = z.object({
  title: z.string().min(1),
  brand: z.string().optional(),
  oemNumber: z.string().optional(),
  partType: z.enum(['oem', 'oes', 'aftermarket', 'genuine']),
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().optional(),
  description: z.string().max(2000).optional(),
  fitmentNotes: z.string().max(1000).optional(),
})
type FormValues = z.infer<typeof formSchema>

interface PartRequestFormProps {
  sellerId: string
  onSubmitted: () => void
}

/** Requirement 2's "can't find this part?" fallback — a distinct flow from the buyer-facing RFQ system (features/rfq), different actor and purpose. Submits into the admin approval queue; see SellerPartRequestsPage for the seller's own queue-status view. */
export function PartRequestForm({ sellerId, onSubmitted }: PartRequestFormProps) {
  const { t } = useTranslation()
  const [images, setImages] = useState<string[]>([])
  const [pathToken] = useState(() => crypto.randomUUID())

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { partType: 'aftermarket', categorySlug: CATEGORY_TREE[0]?.slug ?? '' },
  })

  const categorySlug = watch('categorySlug')
  const subcategories = CATEGORY_TREE.find((c) => c.slug === categorySlug)?.subcategories ?? []

  async function onSubmit(values: FormValues) {
    try {
      await submitPartRequest({
        title: values.title,
        brand: values.brand || undefined,
        oemNumber: values.oemNumber || undefined,
        partType: values.partType,
        categorySlug: values.categorySlug,
        subcategorySlug: values.subcategorySlug || undefined,
        description: values.description || undefined,
        fitmentNotes: values.fitmentNotes || undefined,
        images,
        attributes: {},
      })
      toast.success(t('sellerListings.partRequest.submitSuccess'))
      onSubmitted()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerListings.partRequest.title')}</h2>
        <p className="text-sm text-steel">{t('sellerListings.partRequest.description')}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pr-title">{t('sellerListings.partRequest.titleLabel')}</Label>
        <Input id="pr-title" {...register('title')} />
        {errors.title ? <p role="alert" className="text-sm text-alert">{errors.title.message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pr-brand">{t('sellerListings.partRequest.brandLabel')}</Label>
          <Input id="pr-brand" {...register('brand')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-oem">{t('sellerListings.partRequest.oemNumberLabel')}</Label>
          <Input id="pr-oem" className="font-mono" {...register('oemNumber')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pr-partType">{t('sellerListings.partRequest.partTypeLabel')}</Label>
        <select
          id="pr-partType"
          {...register('partType')}
          className="flex min-h-tap w-full max-w-xs rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {PART_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {t(`sellerListings.partRequest.partType.${pt}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pr-category">{t('sellerListings.partRequest.categoryLabel')}</Label>
          <select
            id="pr-category"
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
        {subcategories.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="pr-subcategory">{t('sellerListings.partRequest.subcategoryLabel')}</Label>
            <select
              id="pr-subcategory"
              {...register('subcategorySlug')}
              className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <option value="">{t('sellerListings.partRequest.noSubcategory')}</option>
              {subcategories.map((sc) => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pr-description">{t('sellerListings.partRequest.specsLabel')}</Label>
        <textarea
          id="pr-description"
          rows={3}
          {...register('description')}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pr-fitment">{t('sellerListings.partRequest.fitmentLabel')}</Label>
        <textarea
          id="pr-fitment"
          rows={2}
          placeholder={t('sellerListings.partRequest.fitmentPlaceholder')}
          {...register('fitmentNotes')}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>

      <ImageUploader sellerId={sellerId} pathToken={pathToken} images={images} onChange={setImages} />

      <Button type="submit" variant="cta" disabled={isSubmitting}>
        {t('sellerListings.partRequest.submit')}
      </Button>
    </form>
  )
}
