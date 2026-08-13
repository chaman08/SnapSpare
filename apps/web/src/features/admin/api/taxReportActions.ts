import type {
  ExportEwayBillTasksRequest,
  ExportEwayBillTasksResult,
  GetGmvTaxReportRequest,
  GetGmvTaxReportResult,
  GetGstr1SummaryRequest,
  GetGstr1SummaryResult,
  GetTcsSummaryRequest,
  GetTcsSummaryResult,
  GetTdsSummaryRequest,
  GetTdsSummaryResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getGstr1SummaryReportCallable = httpsCallable<GetGstr1SummaryRequest, GetGstr1SummaryResult>(
  functions,
  'getGstr1SummaryReport',
)
const getTcsSummaryReportCallable = httpsCallable<GetTcsSummaryRequest, GetTcsSummaryResult>(
  functions,
  'getTcsSummaryReport',
)
const getTdsSummaryReportCallable = httpsCallable<GetTdsSummaryRequest, GetTdsSummaryResult>(
  functions,
  'getTdsSummaryReport',
)
const getGmvTaxReportCallable = httpsCallable<GetGmvTaxReportRequest, GetGmvTaxReportResult>(
  functions,
  'getGmvTaxReport',
)
const exportEwayBillTasksCallable = httpsCallable<ExportEwayBillTasksRequest, ExportEwayBillTasksResult>(
  functions,
  'exportEwayBillTasks',
)

export const getGstr1SummaryReport = (request: GetGstr1SummaryRequest) =>
  getGstr1SummaryReportCallable(request).then((r) => r.data)
export const getTcsSummaryReport = (request: GetTcsSummaryRequest) =>
  getTcsSummaryReportCallable(request).then((r) => r.data)
export const getTdsSummaryReport = (request: GetTdsSummaryRequest) =>
  getTdsSummaryReportCallable(request).then((r) => r.data)
export const getGmvTaxReport = (request: GetGmvTaxReportRequest) => getGmvTaxReportCallable(request).then((r) => r.data)
export const exportEwayBillTasksAdmin = (request: ExportEwayBillTasksRequest) =>
  exportEwayBillTasksCallable(request).then((r) => r.data)

/** Triggers a browser download of a CSV string — shared by every report on this page. */
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
