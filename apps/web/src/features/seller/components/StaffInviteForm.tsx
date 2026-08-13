import type { SellerStaffPermission, SellerStaffRole } from '@snapspare/shared'
import { SELLER_STAFF_PERMISSION_MATRIX, mobileSchema } from '@snapspare/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { inviteSellerStaff } from '@/features/seller/api/sellerStaffActions'

const formSchema = z.object({
  name: z.string().min(1),
  phone: mobileSchema,
  role: z.enum(['manager', 'packer']),
})
type FormValues = z.infer<typeof formSchema>

const ROLES: Exclude<SellerStaffRole, 'owner'>[] = ['manager', 'packer']

interface StaffInviteFormProps {
  onInvited: () => void
}

export function StaffInviteForm({ onInvited }: StaffInviteFormProps) {
  const { t } = useTranslation()
  const [permissions, setPermissions] = useState<SellerStaffPermission[]>(SELLER_STAFF_PERMISSION_MATRIX.manager)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', phone: '', role: 'manager' },
  })

  const role = watch('role')
  const maxPermissions = SELLER_STAFF_PERMISSION_MATRIX[role]

  function togglePermission(permission: SellerStaffPermission) {
    setPermissions((current) =>
      current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission],
    )
  }

  function selectRole(nextRole: 'manager' | 'packer') {
    setValue('role', nextRole)
    setPermissions(SELLER_STAFF_PERMISSION_MATRIX[nextRole])
  }

  const submit = handleSubmit(async (values) => {
    try {
      await inviteSellerStaff({ name: values.name, phone: values.phone, role: values.role, permissions })
      toast.success(t('sellerStaff.invite.success'))
      reset()
      setPermissions(SELLER_STAFF_PERMISSION_MATRIX.manager)
      onInvited()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  })

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[6px] border border-steel/20 p-4" noValidate>
      <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerStaff.invite.title')}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="staffName">{t('sellerStaff.invite.name')}</Label>
          <Input id="staffName" {...register('name')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staffPhone">{t('sellerStaff.invite.phone')}</Label>
          <Input id="staffPhone" inputMode="numeric" {...register('phone')} />
          {errors.phone ? (
            <p role="alert" className="text-sm text-alert">
              {t('auth.errors.invalidPhone')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('sellerStaff.invite.role')}</Label>
        <RadioGroup name="role" value={role} onValueChange={(v) => selectRole(v as 'manager' | 'packer')} aria-label={t('sellerStaff.invite.role')} className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <RadioGroupItem key={r} value={r}>
              {t(`sellerStaff.roleOption.${r}`)}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label>{t('sellerStaff.invite.permissions')}</Label>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {maxPermissions.map((permission) => (
            <label key={permission} className="flex min-h-tap items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-signal"
                checked={permissions.includes(permission)}
                onChange={() => togglePermission(permission)}
              />
              {t(`sellerStaff.permission.${permission}`)}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" variant="cta" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('sellerStaff.invite.submit')}
      </Button>
    </form>
  )
}
