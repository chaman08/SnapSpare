import type { SellerApplication, SellerBusinessType } from '@snapspare/shared'
import { CATEGORY_TREE, sellerBusinessTypeSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { saveSellerApplicationStep } from '@/features/sellerOnboarding/api/sellerApplication'
import { StepFooter } from '@/features/sellerOnboarding/components/wizard/StepFooter'

const formSchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().min(1),
  businessType: sellerBusinessTypeSchema,
  yearsInBusiness: z.coerce.number().int().nonnegative(),
  categorySlugs: z.array(z.string()).min(1, 'select_at_least_one'),
  brandsDealtIn: z.string(),
})
type FormValues = z.infer<typeof formSchema>

const BUSINESS_TYPES: SellerBusinessType[] = ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'individual', 'other']

interface StepBusinessProps {
  uid: string
  status: SellerApplication['status'] | undefined
  initial: SellerApplication['business'] | undefined
  onSaved: () => void
}

export function StepBusiness({ uid, status, initial, onSaved }: StepBusinessProps) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legalName: initial?.legalName ?? '',
      tradeName: initial?.tradeName ?? '',
      businessType: initial?.businessType ?? 'proprietorship',
      yearsInBusiness: initial?.yearsInBusiness ?? 0,
      categorySlugs: initial?.categorySlugs ?? [],
      brandsDealtIn: initial?.brandsDealtIn?.join(', ') ?? '',
    },
  })

  const selectedCategories = watch('categorySlugs')
  const businessType = watch('businessType')

  function toggleCategory(slug: string) {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((s) => s !== slug)
      : [...selectedCategories, slug]
    setValue('categorySlugs', next, { shouldValidate: true })
  }

  const submit = handleSubmit(async (values) => {
    await saveSellerApplicationStep(uid, status, {
      currentStep: 2,
      business: {
        legalName: values.legalName,
        tradeName: values.tradeName,
        businessType: values.businessType,
        yearsInBusiness: values.yearsInBusiness,
        categorySlugs: values.categorySlugs,
        brandsDealtIn: values.brandsDealtIn
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
      },
    })
    onSaved()
  })

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="legalName">{t('sell.wizard.business.legalName')}</Label>
          <Input id="legalName" {...register('legalName')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tradeName">{t('sell.wizard.business.tradeName')}</Label>
          <Input id="tradeName" {...register('tradeName')} />
          <p className="text-xs text-steel">{t('sell.wizard.business.tradeNameHint')}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('sell.wizard.business.businessType')}</Label>
        <RadioGroup
          name="businessType"
          value={businessType}
          onValueChange={(v) => setValue('businessType', v as SellerBusinessType, { shouldValidate: true })}
          aria-label={t('sell.wizard.business.businessType')}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {BUSINESS_TYPES.map((type) => (
            <RadioGroupItem key={type} value={type}>
              {t(`sell.wizard.business.businessTypeOption.${type}`)}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="yearsInBusiness">{t('sell.wizard.business.yearsInBusiness')}</Label>
        <Input id="yearsInBusiness" type="number" min={0} inputMode="numeric" {...register('yearsInBusiness')} />
      </div>

      <div className="space-y-1.5">
        <Label>{t('sell.wizard.business.categories')}</Label>
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-[6px] border border-steel/20 p-2 sm:grid-cols-3">
          {CATEGORY_TREE.map((category) => (
            <label key={category.slug} className="flex min-h-tap items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-signal"
                checked={selectedCategories.includes(category.slug)}
                onChange={() => toggleCategory(category.slug)}
              />
              {category.name}
            </label>
          ))}
        </div>
        {errors.categorySlugs ? (
          <p role="alert" className="text-sm text-alert">
            {t('sell.wizard.business.categoriesRequired')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brandsDealtIn">{t('sell.wizard.business.brandsDealtIn')}</Label>
        <Input id="brandsDealtIn" placeholder={t('sell.wizard.business.brandsDealtInPlaceholder')} {...register('brandsDealtIn')} />
        <p className="text-xs text-steel">{t('sell.wizard.business.brandsDealtInHint')}</p>
      </div>

      <StepFooter isSubmitting={isSubmitting} />
    </form>
  )
}
