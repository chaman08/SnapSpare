import type { IndianStateCode, SellerApplication } from '@snapspare/shared'
import { INDIAN_STATE_CODE_LIST, INDIAN_STATE_CODES, mobileSchema, pincodeSchema, stateCodeSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { type FocusEvent, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { lookupPincode } from '@/features/auth/api/pincodeLookup'
import { checkPickupPincodeServiceability } from '@/features/sellerOnboarding/api/pickupServiceability'
import { saveSellerApplicationStep } from '@/features/sellerOnboarding/api/sellerApplication'
import { StepFooter } from '@/features/sellerOnboarding/components/wizard/StepFooter'

const addressSchema = z.object({
  contactName: z.string().min(1),
  contactPhone: mobileSchema,
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  pincode: pincodeSchema,
})

const pickupAddressSchema = addressSchema.extend({
  id: z.string(),
  label: z.string().min(1),
  isDefault: z.boolean(),
  serviceable: z.boolean().optional(),
})

const formSchema = z.object({
  registeredAddress: addressSchema,
  pickupAddresses: z.array(pickupAddressSchema).min(1, 'at_least_one_pickup_address'),
})
type FormValues = z.infer<typeof formSchema>

function emptyPickupAddress(isDefault: boolean) {
  return {
    id: crypto.randomUUID(),
    label: '',
    contactName: '',
    contactPhone: '',
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: '',
    stateCode: '',
    pincode: '',
    isDefault,
    serviceable: undefined,
  }
}

interface StepAddressesProps {
  uid: string
  status: SellerApplication['status'] | undefined
  initialRegistered: SellerApplication['registeredAddress'] | undefined
  initialPickup: SellerApplication['pickupAddresses'] | undefined
  onSaved: () => void
  onBack: () => void
}

export function StepAddresses({ uid, status, initialRegistered, initialPickup, onSaved, onBack }: StepAddressesProps) {
  const { t } = useTranslation()
  const [pincodeState, setPincodeState] = useState<Record<string, 'idle' | 'checking' | 'notFound'>>({})

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registeredAddress: initialRegistered ?? {
        contactName: '',
        contactPhone: '',
        line1: '',
        line2: '',
        landmark: '',
        city: '',
        state: '',
        stateCode: '',
        pincode: '',
      },
      pickupAddresses: initialPickup && initialPickup.length > 0 ? initialPickup : [emptyPickupAddress(true)],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'pickupAddresses' })

  async function handleRegisteredPincodeBlur(event: FocusEvent<HTMLInputElement>) {
    const pincode = event.target.value
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return
    const result = await lookupPincode(pincode)
    if (result) {
      setValue('registeredAddress.city', result.city, { shouldValidate: true })
      setValue('registeredAddress.state', result.state, { shouldValidate: true })
      setValue('registeredAddress.stateCode', result.stateCode, { shouldValidate: true })
    }
  }

  async function handlePickupPincodeBlur(index: number, event: FocusEvent<HTMLInputElement>) {
    const pincode = event.target.value
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return
    setPincodeState((s) => ({ ...s, [index]: 'checking' }))
    const result = await checkPickupPincodeServiceability(pincode)
    if (result.serviceable && result.city && result.state && result.stateCode) {
      setValue(`pickupAddresses.${index}.city`, result.city, { shouldValidate: true })
      setValue(`pickupAddresses.${index}.state`, result.state, { shouldValidate: true })
      setValue(`pickupAddresses.${index}.stateCode`, result.stateCode, { shouldValidate: true })
      setValue(`pickupAddresses.${index}.serviceable`, true)
      setPincodeState((s) => ({ ...s, [index]: 'idle' }))
    } else {
      setValue(`pickupAddresses.${index}.serviceable`, false)
      setPincodeState((s) => ({ ...s, [index]: 'notFound' }))
    }
  }

  function makeDefault(index: number) {
    fields.forEach((_, i) => setValue(`pickupAddresses.${i}.isDefault`, i === index))
  }

  function selectRegisteredState(code: string) {
    setValue('registeredAddress.stateCode', code as IndianStateCode, { shouldValidate: true })
    setValue('registeredAddress.state', INDIAN_STATE_CODES[code as IndianStateCode], { shouldValidate: true })
  }

  function selectPickupState(index: number, code: string) {
    setValue(`pickupAddresses.${index}.stateCode`, code as IndianStateCode, { shouldValidate: true })
    setValue(`pickupAddresses.${index}.state`, INDIAN_STATE_CODES[code as IndianStateCode], { shouldValidate: true })
  }

  const submit = handleSubmit(async (values) => {
    await saveSellerApplicationStep(uid, status, {
      currentStep: 4,
      registeredAddress: values.registeredAddress,
      pickupAddresses: values.pickupAddresses.map(({ serviceable, ...address }) =>
        serviceable === undefined ? address : { ...address, serviceable },
      ),
    })
    onSaved()
  })

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="font-heading text-base font-semibold text-ink">{t('sell.wizard.addresses.registeredTitle')}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder={t('address.form.contactName')} {...register('registeredAddress.contactName')} />
          <Input placeholder={t('address.form.contactPhone')} inputMode="numeric" {...register('registeredAddress.contactPhone')} />
        </div>
        <Input placeholder={t('address.form.line1')} {...register('registeredAddress.line1')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder={t('address.form.line2')} {...register('registeredAddress.line2')} />
          <Input placeholder={t('address.form.landmark')} {...register('registeredAddress.landmark')} />
        </div>
        <Input
          placeholder={t('address.form.pincode')}
          inputMode="numeric"
          maxLength={6}
          {...register('registeredAddress.pincode', { onBlur: handleRegisteredPincodeBlur })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder={t('address.form.city')} {...register('registeredAddress.city')} />
          <Select value={watch('registeredAddress.stateCode') || undefined} onValueChange={selectRegisteredState}>
            <SelectTrigger aria-label={t('address.form.state')}>
              <SelectValue placeholder={t('address.form.state')} />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATE_CODE_LIST.map((code) => (
                <SelectItem key={code} value={code}>
                  {INDIAN_STATE_CODES[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input type="hidden" {...register('registeredAddress.state')} />
        <input type="hidden" {...register('registeredAddress.stateCode')} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-heading text-base font-semibold text-ink">{t('sell.wizard.addresses.pickupTitle')}</legend>
        <p className="text-sm text-steel">{t('sell.wizard.addresses.pickupHint')}</p>

        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-[6px] border border-steel/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <Input placeholder={t('sell.wizard.addresses.pickupLabel')} {...register(`pickupAddresses.${index}.label`)} />
              {fields.length > 1 ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t('sell.wizard.addresses.removePickup')}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder={t('address.form.contactName')} {...register(`pickupAddresses.${index}.contactName`)} />
              <Input placeholder={t('address.form.contactPhone')} inputMode="numeric" {...register(`pickupAddresses.${index}.contactPhone`)} />
            </div>
            <Input placeholder={t('address.form.line1')} {...register(`pickupAddresses.${index}.line1`)} />
            <Input
              placeholder={t('address.form.pincode')}
              inputMode="numeric"
              maxLength={6}
              {...register(`pickupAddresses.${index}.pincode`, { onBlur: (e) => handlePickupPincodeBlur(index, e) })}
            />
            {pincodeState[index] === 'checking' ? <p className="text-xs text-steel">{t('address.form.pincodeChecking')}</p> : null}
            {pincodeState[index] === 'notFound' ? (
              <p className="text-xs text-alert">{t('sell.wizard.addresses.notServiceable')}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder={t('address.form.city')} {...register(`pickupAddresses.${index}.city`)} />
              <Select
                value={watch(`pickupAddresses.${index}.stateCode`) || undefined}
                onValueChange={(code) => selectPickupState(index, code)}
              >
                <SelectTrigger aria-label={t('address.form.state')}>
                  <SelectValue placeholder={t('address.form.state')} />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATE_CODE_LIST.map((code) => (
                    <SelectItem key={code} value={code}>
                      {INDIAN_STATE_CODES[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input type="hidden" {...register(`pickupAddresses.${index}.state`)} />
            <input type="hidden" {...register(`pickupAddresses.${index}.stateCode`)} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" className="h-4 w-4 accent-signal" checked={watch(`pickupAddresses.${index}.isDefault`)} onChange={() => makeDefault(index)} />
              {t('sell.wizard.addresses.setDefault')}
            </label>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={() => append(emptyPickupAddress(false))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('sell.wizard.addresses.addPickup')}
        </Button>
        {errors.pickupAddresses ? (
          <p role="alert" className="text-sm text-alert">
            {t('sell.wizard.addresses.atLeastOnePickup')}
          </p>
        ) : null}
      </fieldset>

      <StepFooter onBack={onBack} isSubmitting={isSubmitting} />
    </form>
  )
}
