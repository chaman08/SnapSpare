import type {
  ExportEwayBillTasksRequest,
  ExportEwayBillTasksResult,
  MarkEwayBillGeneratedRequest,
  MarkEwayBillGeneratedResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const markEwayBillGeneratedCallable = httpsCallable<MarkEwayBillGeneratedRequest, MarkEwayBillGeneratedResult>(
  functions,
  'markEwayBillGenerated',
)
const exportEwayBillTasksCallable = httpsCallable<ExportEwayBillTasksRequest, ExportEwayBillTasksResult>(
  functions,
  'exportEwayBillTasks',
)

export const markEwayBillGenerated = (request: MarkEwayBillGeneratedRequest) =>
  markEwayBillGeneratedCallable(request).then((r) => r.data)

export const exportEwayBillTasks = (request: ExportEwayBillTasksRequest = {}) =>
  exportEwayBillTasksCallable(request).then((r) => r.data)

/** Triggers a browser download of a CSV string returned by an exportEwayBillTasks/admin-report callable — shared by the seller e-way-bill panel and the admin GST reports page. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
