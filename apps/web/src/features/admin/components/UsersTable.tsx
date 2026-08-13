import type { User } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminSetUserFlags, startImpersonation, useAdminUsers } from '@/features/admin/api/userAdminActions'
import { cn } from '@/lib/utils'

/** Users module (design brief item 11): search, flags, impersonate, and a link out to credit-limit management (already its own page). */
export function UsersTable() {
  const { t } = useTranslation()
  const [phoneFilter, setPhoneFilter] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const { users, loading } = useAdminUsers(phoneFilter)
  const [managing, setManaging] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  async function toggleFlag(user: User, flag: 'codAbuseFlag' | 'returnAbuseFlag') {
    setBusy(true)
    try {
      await adminSetUserFlags({ userId: user.id, [flag]: !user[flag] })
      toast.success(t('admin.users.flagUpdateSuccess'))
    } catch {
      toast.error(t('admin.users.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function impersonate(user: User) {
    const reason = window.prompt(t('admin.users.impersonateReasonPrompt'))
    if (!reason || reason.trim().length === 0) return
    setBusy(true)
    try {
      const result = await startImpersonation({ userId: user.id, reason: reason.trim() })
      window.open(`/impersonate#token=${encodeURIComponent(result.customToken)}`, '_blank', 'noopener')
    } catch {
      toast.error(t('admin.users.impersonateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder={t('admin.users.phoneSearchPlaceholder')} value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={() => setPhoneFilter(phoneInput)}>
          {t('admin.orders.searchAction')}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/credit-approvals">{t('admin.nav.creditApprovals')}</Link>
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <EmptyState title={t('admin.users.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.users.name')}</TableHead>
              <TableHead>{t('admin.users.phone')}</TableHead>
              <TableHead>{t('admin.users.flags')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.displayName}</TableCell>
                <TableCell className="font-mono text-xs">{user.phone ?? '—'}</TableCell>
                <TableCell className="text-xs">
                  {user.codAbuseFlag && <span className="mr-1 rounded-full bg-alert/10 px-2 py-0.5 text-alert">{t('admin.users.codAbuse')}</span>}
                  {user.returnAbuseFlag && <span className="rounded-full bg-alert/10 px-2 py-0.5 text-alert">{t('admin.users.returnAbuse')}</span>}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setManaging(user)}>
                    {t('admin.sellers.manage')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(managing)} onOpenChange={(open) => !open && setManaging(null)}>
        <DialogContent>
          {managing && (
            <>
              <DialogHeader>
                <DialogTitle>{managing.displayName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('w-full justify-start', managing.codAbuseFlag && 'border-alert text-alert')}
                  onClick={() => toggleFlag(managing, 'codAbuseFlag')}
                  disabled={busy}
                >
                  {managing.codAbuseFlag ? t('admin.users.clearCodAbuse') : t('admin.users.setCodAbuse')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('w-full justify-start', managing.returnAbuseFlag && 'border-alert text-alert')}
                  onClick={() => toggleFlag(managing, 'returnAbuseFlag')}
                  disabled={busy}
                >
                  {managing.returnAbuseFlag ? t('admin.users.clearReturnAbuse') : t('admin.users.setReturnAbuse')}
                </Button>
                <Button size="sm" className="w-full" onClick={() => impersonate(managing)} disabled={busy}>
                  {t('admin.users.impersonateAction')}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setManaging(null)} disabled={busy}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
