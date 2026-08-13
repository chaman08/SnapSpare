import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminSaveCatalogFitment, useFitmentSearch } from '@/features/admin/api/fitmentActions'

/** Fitment workbench (design brief item 4): search by part or vehicle model, add a new mapping, verify/edit existing rows. */
export function FitmentWorkbench() {
  const { t } = useTranslation()
  const { rows, loading, searched, search } = useFitmentSearch()
  const [searchField, setSearchField] = useState<'partId' | 'modelId'>('partId')
  const [searchValue, setSearchValue] = useState('')

  const [newPartId, setNewPartId] = useState('')
  const [newMakeId, setNewMakeId] = useState('')
  const [newModelId, setNewModelId] = useState('')
  const [newVariantId, setNewVariantId] = useState('')
  const [busy, setBusy] = useState(false)

  async function runSearch() {
    if (!searchValue.trim()) return
    await search(searchField, searchValue)
  }

  async function addFitment() {
    if (!newPartId.trim() || !newMakeId.trim() || !newModelId.trim()) return
    setBusy(true)
    try {
      const result = await adminSaveCatalogFitment({
        partId: newPartId.trim(),
        makeId: newMakeId.trim(),
        modelId: newModelId.trim(),
        variantId: newVariantId.trim() || undefined,
        verify: false,
        allowConflict: false,
      })
      if (result.conflictingFitmentIds.length > 0) {
        toast.warning(t('admin.fitment.conflictWarning', { count: result.conflictingFitmentIds.length }))
      } else {
        toast.success(t('admin.fitment.addSuccess'))
      }
      setNewPartId('')
      setNewMakeId('')
      setNewModelId('')
      setNewVariantId('')
      if (searched) await search(searchField, searchValue)
    } catch (error) {
      const details = (error as { details?: { conflictingFitmentIds?: string[] } }).details
      if (details?.conflictingFitmentIds?.length) {
        toast.error(t('admin.fitment.conflictBlocked', { count: details.conflictingFitmentIds.length }))
      } else {
        toast.error(t('admin.fitment.saveFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function verifyRow(rowId: string, partId: string, makeId: string, modelId: string, variantId?: string) {
    setBusy(true)
    try {
      await adminSaveCatalogFitment({ id: rowId, partId, makeId, modelId, variantId, verify: true, allowConflict: true })
      toast.success(t('admin.fitment.verifySuccess'))
      if (searched) await search(searchField, searchValue)
    } catch {
      toast.error(t('admin.fitment.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-[6px] border border-steel/20 p-4">
        <p className="text-sm font-medium text-ink">{t('admin.fitment.addNewTitle')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input placeholder={t('admin.fitment.partId')} value={newPartId} onChange={(e) => setNewPartId(e.target.value)} disabled={busy} />
          <Input placeholder={t('admin.fitment.makeId')} value={newMakeId} onChange={(e) => setNewMakeId(e.target.value)} disabled={busy} />
          <Input placeholder={t('admin.fitment.modelId')} value={newModelId} onChange={(e) => setNewModelId(e.target.value)} disabled={busy} />
          <Input placeholder={t('admin.fitment.variantIdOptional')} value={newVariantId} onChange={(e) => setNewVariantId(e.target.value)} disabled={busy} />
        </div>
        <Button size="sm" onClick={addFitment} disabled={busy || !newPartId.trim() || !newMakeId.trim() || !newModelId.trim()}>
          {t('admin.fitment.addAction')}
        </Button>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-ink">{t('admin.fitment.searchTitle')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="flex min-h-tap rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as 'partId' | 'modelId')}
          >
            <option value="partId">{t('admin.fitment.byPart')}</option>
            <option value="modelId">{t('admin.fitment.byVehicle')}</option>
          </select>
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="fitment-search-value">{t('admin.fitment.searchValueLabel')}</Label>
            <Input id="fitment-search-value" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
          </div>
          <Button onClick={runSearch} disabled={loading || !searchValue.trim()}>
            {t('admin.orders.searchAction')}
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !searched ? null : rows.length === 0 ? (
          <EmptyState title={t('admin.fitment.emptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.fitment.partId')}</TableHead>
                <TableHead>{t('admin.fitment.makeId')}</TableHead>
                <TableHead>{t('admin.fitment.modelId')}</TableHead>
                <TableHead>{t('admin.fitment.verified')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.partId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.makeId}</TableCell>
                  <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                  <TableCell className="text-xs">
                    {row.verifiedAt ? (
                      <span className="text-verify">{t('admin.fitment.verifiedYes')}</span>
                    ) : (
                      <span className="text-signal">{t('admin.fitment.verifiedNo')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!row.verifiedAt && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => verifyRow(row.id, row.partId, row.makeId, row.modelId, row.variantId)}>
                        {t('admin.fitment.verifyAction')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
