import type { SellerStaff } from '@snapspare/shared'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { removeSellerStaff } from '@/features/seller/api/sellerStaffActions'
import { cn } from '@/lib/utils'

interface StaffListProps {
  staff: SellerStaff[]
  loading: boolean
}

const STATUS_STYLES: Record<SellerStaff['status'], string> = {
  active: 'bg-verify/10 text-verify',
  invited: 'bg-signal/10 text-signal',
  removed: 'bg-steel/10 text-steel',
}

export function StaffList({ staff, loading }: StaffListProps) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  // Owner (no staffRole claim) can always manage staff; a staff member needs the permission explicitly — mirrors firestore.rules' hasSellerPermission().
  const canManageStaff = !claims?.staffRole || (claims.permissions ?? []).includes('manage_staff')

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const visible = staff.filter((s) => s.status !== 'removed')
  if (visible.length === 0) {
    return <EmptyState title={t('sellerStaff.list.emptyTitle')} description={t('sellerStaff.list.emptyDescription')} />
  }

  async function handleRemove(sellerStaffId: string) {
    try {
      await removeSellerStaff({ sellerStaffId })
      toast.success(t('sellerStaff.list.removed'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  return (
    <ul className="space-y-2">
      {visible.map((member) => (
        <li key={member.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-3">
          <div>
            <p className="text-sm font-medium text-ink">{member.name}</p>
            <p className="font-mono-data text-xs text-steel">+91 {member.phone}</p>
            <p className="text-xs text-steel">{t(`sellerStaff.roleOption.${member.role}`)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[member.status])}>
              {t(`sellerStaff.status.${member.status}`)}
            </span>
            {canManageStaff ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(member.id)}
                aria-label={t('sellerStaff.list.remove')}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
