import type { EwayBillTask } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadCsv, exportEwayBillTasks, markEwayBillGenerated } from '@/features/seller/api/ewayBillActions'
import { useEwayBillTasks } from '@/features/seller/api/useEwayBillTasks'

/**
 * Seller console to-do list for shipments whose consignment value crossed
 * the e-way-bill threshold (design brief item 6). No live NIC/GSP filing —
 * a seller downloads the JSON/CSV payload, files it manually on the GST
 * portal, then records the resulting number here via markEwayBillGenerated.
 */
export function EwayBillTasksPanel({ sellerId }: { sellerId: string | undefined }) {
  const { t } = useTranslation()
  const { tasks, loading } = useEwayBillTasks(sellerId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)

  const pending = tasks.filter((task) => task.status === 'pending')
  const generated = tasks.filter((task) => task.status === 'generated')

  async function handleDownloadJson(task: EwayBillTask) {
    const blob = new Blob([JSON.stringify(task.payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${task.payload.docNo.replace(/\//g, '-')}-ewaybill.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleExportCsv() {
    setExporting(true)
    try {
      const result = await exportEwayBillTasks({ sellerId, status: 'pending' })
      downloadCsv(result.csv, 'eway-bill-tasks.csv')
    } catch {
      toast.error(t('sellerOrders.ewayBill.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  async function handleMarkGenerated(taskId: string) {
    const number = numberDrafts[taskId]?.trim()
    if (!number) return
    setBusyId(taskId)
    try {
      await markEwayBillGenerated({ ewayBillTaskId: taskId, ewayBillNumber: number })
      toast.success(t('sellerOrders.ewayBill.marked'))
    } catch {
      toast.error(t('sellerOrders.ewayBill.markFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Skeleton className="h-24 w-full" />
  if (tasks.length === 0) {
    return <EmptyState title={t('sellerOrders.ewayBill.emptyTitle')} description={t('sellerOrders.ewayBill.emptyDescription')} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerOrders.ewayBill.title')}</h2>
        <Button type="button" variant="outline" size="sm" disabled={exporting || pending.length === 0} onClick={handleExportCsv}>
          {exporting ? t('common.loading') : t('sellerOrders.ewayBill.exportCsv')}
        </Button>
      </div>

      {pending.length === 0 ? null : (
        <ul className="space-y-3">
          {pending.map((task) => (
            <li key={task.id} className="rounded-[6px] border border-alert/30 bg-alert/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-ink">{task.payload.docNo}</p>
                  <p className="text-xs text-steel">{t('sellerOrders.ewayBill.consignmentValue')}: {formatINR(task.consignmentValuePaise)}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadJson(task)}>
                  {t('sellerOrders.ewayBill.downloadJson')}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={numberDrafts[task.id] ?? ''}
                  onChange={(e) => setNumberDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  placeholder={t('sellerOrders.ewayBill.numberPlaceholder')}
                  className="max-w-xs"
                  aria-label={t('sellerOrders.ewayBill.numberPlaceholder')}
                />
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  disabled={busyId === task.id || !numberDrafts[task.id]?.trim()}
                  onClick={() => void handleMarkGenerated(task.id)}
                >
                  {t('sellerOrders.ewayBill.markGenerated')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {generated.length === 0 ? null : (
        <div>
          <p className="text-sm font-medium text-steel">{t('sellerOrders.ewayBill.generatedTitle')}</p>
          <ul className="mt-2 space-y-2">
            {generated.map((task) => (
              <li key={task.id} className="flex items-center justify-between rounded-[6px] border border-steel/20 p-3 text-sm">
                <span className="font-mono text-ink">{task.payload.docNo}</span>
                <span className="font-mono text-verify">{task.ewayBillNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
