import type { SellerSettings } from '@snapspare/shared'
import { storeSlugSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setStoreSlug, updateStorePage } from '@/features/seller/api/sellerSettingsActions'

interface StorePageFormProps {
  sellerId: string
  initial: SellerSettings | null
}

const formSchema = z.object({
  storeName: z.string().min(1).optional().or(z.literal('')),
  storeDescription: z.string().max(2000).optional().or(z.literal('')),
  storeSlug: storeSlugSchema.optional().or(z.literal('')),
})
type FormValues = z.infer<typeof formSchema>

export function StorePageForm({ sellerId, initial }: StorePageFormProps) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      storeName: initial?.storeName ?? '',
      storeDescription: initial?.storeDescription ?? '',
      storeSlug: initial?.storeSlug ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      await updateStorePage(sellerId, { storeName: values.storeName, storeDescription: values.storeDescription })
      if (values.storeSlug && values.storeSlug !== initial?.storeSlug) {
        await setStoreSlug({ slug: values.storeSlug })
      }
      toast.success(t('sellerSettings.saved'))
    } catch (error) {
      const message = (error as { message?: string } | null)?.message ?? ''
      toast.error(
        message === 'slug_taken' ? t('sellerSettings.storePage.slugTaken') : t('common.somethingWentWrong'),
      )
    }
  }

  return (
    <form className="space-y-3 rounded-[6px] border border-steel/20 p-4" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerSettings.storePage.title')}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="storeName">{t('sellerSettings.storePage.storeName')}</Label>
        <Input id="storeName" {...register('storeName')} />
        {errors.storeName ? <p className="text-sm text-alert">{errors.storeName.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="storeSlug">{t('sellerSettings.storePage.storeSlug')}</Label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-steel">/store/</span>
          <Input id="storeSlug" {...register('storeSlug')} className="font-mono" />
        </div>
        {errors.storeSlug ? (
          <p className="text-sm text-alert">{errors.storeSlug.message}</p>
        ) : (
          <p className="text-xs text-steel">{t('sellerSettings.storePage.storeSlugHint')}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="storeDescription">{t('sellerSettings.storePage.storeDescription')}</Label>
        <textarea
          id="storeDescription"
          rows={4}
          {...register('storeDescription')}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        {errors.storeDescription ? <p className="text-sm text-alert">{errors.storeDescription.message}</p> : null}
      </div>
      <Button type="submit" variant="cta" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('sellerSettings.save')}
      </Button>
    </form>
  )
}
