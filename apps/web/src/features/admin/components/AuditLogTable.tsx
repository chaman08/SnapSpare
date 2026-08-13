import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuditLog } from '@/features/admin/api/auditLogActions'

export function AuditLogTable() {
  const { t } = useTranslation()
  const [targetTypeFilter, setTargetTypeFilter] = useState('')
  const [actorIdFilter, setActorIdFilter] = useState('')
  const { entries, loading } = useAuditLog(targetTypeFilter, actorIdFilter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder={t('admin.auditLog.targetTypeFilter')}
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
        />
        <Input
          className="max-w-xs"
          placeholder={t('admin.auditLog.actorIdFilter')}
          value={actorIdFilter}
          onChange={(e) => setActorIdFilter(e.target.value)}
          disabled={Boolean(targetTypeFilter.trim())}
        />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.length === 0 ? (
        <EmptyState title={t('admin.auditLog.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.auditLog.action')}</TableHead>
              <TableHead>{t('admin.auditLog.target')}</TableHead>
              <TableHead>{t('admin.auditLog.actor')}</TableHead>
              <TableHead>{t('admin.auditLog.when')}</TableHead>
              <TableHead>{t('admin.auditLog.note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.targetType}/{entry.targetId}
                </TableCell>
                <TableCell className="text-xs">{entry.actorEmail ?? entry.actorId}</TableCell>
                <TableCell className="text-xs text-steel">{new Date(entry.createdAt).toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-xs text-steel">{entry.note ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
