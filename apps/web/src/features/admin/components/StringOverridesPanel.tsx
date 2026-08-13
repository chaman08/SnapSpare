import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { setStringOverride, useStringOverrides } from '@/features/admin/api/contentActions'

/** Content module (design brief item 10): admin-editable i18next string overrides — see stringOverride.ts's header comment on the runtime-wiring gap. */
export function StringOverridesPanel() {
  const { t } = useTranslation()
  const { overrides, loading } = useStringOverrides()
  const [key, setKey] = useState('')
  const [en, setEn] = useState('')
  const [hi, setHi] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!key.trim()) return
    setBusy(true)
    try {
      await setStringOverride({ key: key.trim(), en, hi })
      toast.success(t('admin.content.strings.saveSuccess'))
      setKey('')
      setEn('')
      setHi('')
    } catch {
      toast.error(t('admin.content.strings.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder={t('admin.content.strings.keyPlaceholder')} value={key} onChange={(e) => setKey(e.target.value)} disabled={busy} />
        <Input placeholder="English" value={en} onChange={(e) => setEn(e.target.value)} disabled={busy} />
        <Input placeholder="हिन्दी" value={hi} onChange={(e) => setHi(e.target.value)} disabled={busy} />
        <Button size="sm" onClick={save} disabled={busy || !key.trim()}>
          {t('common.save')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : overrides.length === 0 ? (
        <EmptyState title={t('admin.content.strings.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.content.strings.keyPlaceholder')}</TableHead>
              <TableHead>English</TableHead>
              <TableHead>हिन्दी</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overrides.map((override) => (
              <TableRow key={override.id}>
                <TableCell className="font-mono text-xs">{override.key}</TableCell>
                <TableCell className="text-xs">{override.en}</TableCell>
                <TableCell className="text-xs">{override.hi}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
