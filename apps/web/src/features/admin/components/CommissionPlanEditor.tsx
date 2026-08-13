import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { updateCommissionConfig, useCommissionConfig } from '@/features/admin/api/financeActions'

interface CategoryRateRow {
  categorySlug: string
  percent: string
}

/**
 * Finance module's commission-plan editor (design brief item 8): per-category
 * rate table plus the three scalar settlement settings. Time-boxed
 * promotional overrides (`commissionConfig.promotions`) are read-only here —
 * see updateCommissionConfig.ts's schema comment for why that editor is out
 * of scope this pass.
 */
export function CommissionPlanEditor() {
  const { t } = useTranslation()
  const { config, loading } = useCommissionConfig()
  const [rows, setRows] = useState<CategoryRateRow[]>([])
  const [settlementCycleDays, setSettlementCycleDays] = useState('')
  const [creditOverdueGraceDays, setCreditOverdueGraceDays] = useState('')
  const [slaBreachPenaltyRupees, setSlaBreachPenaltyRupees] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!config) return
    setRows(Object.entries(config.categoryRates).map(([categorySlug, rate]) => ({ categorySlug, percent: String(rate.percent) })))
    setSettlementCycleDays(String(config.settlementCycleDays))
    setCreditOverdueGraceDays(String(config.creditOverdueGraceDays))
    setSlaBreachPenaltyRupees(config.slaBreachPenaltyPaise !== undefined ? String(config.slaBreachPenaltyPaise / 100) : '')
  }, [config])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!config) return <p className="text-sm text-steel">{t('admin.finance.commission.notConfigured')}</p>

  function updateRow(index: number, field: keyof CategoryRateRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  async function save() {
    const categoryRates: Record<string, { percent: number }> = {}
    for (const row of rows) {
      const slug = row.categorySlug.trim()
      const percent = Number(row.percent)
      if (!slug || Number.isNaN(percent)) continue
      categoryRates[slug] = { percent }
    }

    setBusy(true)
    try {
      await updateCommissionConfig({
        categoryRates,
        settlementCycleDays: Number(settlementCycleDays) || undefined,
        creditOverdueGraceDays: Number(creditOverdueGraceDays) || undefined,
        slaBreachPenaltyPaise: slaBreachPenaltyRupees.trim() === '' ? null : Math.round(Number(slaBreachPenaltyRupees) * 100),
      })
      toast.success(t('admin.finance.commission.saveSuccess'))
    } catch {
      toast.error(t('admin.finance.commission.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{t('admin.finance.commission.categoryRates')}</p>
          <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { categorySlug: '', percent: '' }])}>
            {t('admin.finance.commission.addRow')}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.finance.commission.categorySlug')}</TableHead>
              <TableHead>{t('admin.finance.commission.percent')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input value={row.categorySlug} onChange={(e) => updateRow(index, 'categorySlug', e.target.value)} disabled={busy} />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={row.percent}
                    onChange={(e) => updateRow(index, 'percent', e.target.value)}
                    disabled={busy}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="settlement-cycle">{t('admin.finance.commission.settlementCycleDays')}</Label>
          <Input id="settlement-cycle" type="number" min={1} value={settlementCycleDays} onChange={(e) => setSettlementCycleDays(e.target.value)} disabled={busy} />
        </div>
        <div>
          <Label htmlFor="grace-days">{t('admin.finance.commission.creditOverdueGraceDays')}</Label>
          <Input id="grace-days" type="number" min={0} value={creditOverdueGraceDays} onChange={(e) => setCreditOverdueGraceDays(e.target.value)} disabled={busy} />
        </div>
        <div>
          <Label htmlFor="sla-penalty">{t('admin.finance.commission.slaBreachPenalty')}</Label>
          <Input id="sla-penalty" type="number" min={0} value={slaBreachPenaltyRupees} onChange={(e) => setSlaBreachPenaltyRupees(e.target.value)} disabled={busy} />
        </div>
      </div>

      <Button onClick={save} disabled={busy}>
        {t('common.save')}
      </Button>
    </div>
  )
}
