import type { SellerApplication } from '@snapspare/shared'
import { ifscSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { type FocusEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupIfsc } from '@/features/sellerOnboarding/api/ifscLookup'
import { saveSellerApplicationStep } from '@/features/sellerOnboarding/api/sellerApplication'
import { DocumentUploadField } from '@/features/sellerOnboarding/components/DocumentUploadField'
import { StepFooter } from '@/features/sellerOnboarding/components/wizard/StepFooter'

const formSchema = z
  .object({
    accountHolderName: z.string().min(1),
    accountNumber: z.string().min(4),
    confirmAccountNumber: z.string().min(4),
    ifsc: ifscSchema,
    bankName: z.string().min(1),
    branch: z.string().optional(),
    cancelledChequeStoragePath: z.string().optional(),
  })
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    path: ['confirmAccountNumber'],
    message: 'account_number_mismatch',
  })
type FormValues = z.infer<typeof formSchema>

interface StepBankProps {
  uid: string
  status: SellerApplication['status'] | undefined
  initial: SellerApplication['bank'] | undefined
  onSaved: () => void
  onBack: () => void
}

export function StepBank({ uid, status, initial, onSaved, onBack }: StepBankProps) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountHolderName: initial?.accountHolderName ?? '',
      accountNumber: initial?.accountNumber ?? '',
      confirmAccountNumber: initial?.accountNumber ?? '',
      ifsc: initial?.ifsc ?? '',
      bankName: initial?.bankName ?? '',
      branch: initial?.branch ?? '',
      cancelledChequeStoragePath: initial?.cancelledChequeStoragePath,
    },
  })

  const chequeStoragePath = watch('cancelledChequeStoragePath')

  async function handleIfscBlur(event: FocusEvent<HTMLInputElement>) {
    const ifsc = event.target.value.toUpperCase()
    if (!ifscSchema.safeParse(ifsc).success) return
    const result = await lookupIfsc(ifsc)
    if (result) {
      setValue('bankName', result.bankName, { shouldValidate: true })
      setValue('branch', result.branch)
    }
  }

  const submit = handleSubmit(async (values) => {
    await saveSellerApplicationStep(uid, status, {
      currentStep: 5,
      bank: {
        accountHolderName: values.accountHolderName,
        accountNumber: values.accountNumber,
        ifsc: values.ifsc,
        bankName: values.bankName,
        branch: values.branch,
        cancelledChequeStoragePath: chequeStoragePath,
      },
    })
    onSaved()
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="accountHolderName">{t('sell.wizard.bank.accountHolderName')}</Label>
        <Input id="accountHolderName" {...register('accountHolderName')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="accountNumber">{t('sell.wizard.bank.accountNumber')}</Label>
          <Input id="accountNumber" className="font-mono-data" inputMode="numeric" {...register('accountNumber')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmAccountNumber">{t('sell.wizard.bank.confirmAccountNumber')}</Label>
          <Input id="confirmAccountNumber" className="font-mono-data" inputMode="numeric" {...register('confirmAccountNumber')} />
          {errors.confirmAccountNumber ? (
            <p role="alert" className="text-sm text-alert">
              {t('sell.wizard.bank.accountNumberMismatch')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ifsc">{t('sell.wizard.bank.ifsc')}</Label>
        <Input id="ifsc" className="font-mono-data uppercase" maxLength={11} {...register('ifsc', { onBlur: handleIfscBlur })} />
        {errors.ifsc ? (
          <p role="alert" className="text-sm text-alert">
            {t('sell.wizard.bank.ifscInvalid')}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bankName">{t('sell.wizard.bank.bankName')}</Label>
          <Input id="bankName" {...register('bankName')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branch">{t('sell.wizard.bank.branch')}</Label>
          <Input id="branch" {...register('branch')} />
        </div>
      </div>

      <DocumentUploadField
        uid={uid}
        docType="cancelled-cheque"
        label={t('sell.wizard.bank.cancelledCheque')}
        hint={t('sell.wizard.bank.cancelledChequeHint')}
        storagePath={chequeStoragePath}
        onUploaded={(path) => setValue('cancelledChequeStoragePath', path)}
      />

      <StepFooter onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  )
}
