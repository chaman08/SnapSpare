import type {
  GetCreditNoteUrlRequest,
  GetCreditNoteUrlResult,
  GetInvoiceUrlRequest,
  GetInvoiceUrlResult,
} from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getInvoiceUrlCallable = httpsCallable<GetInvoiceUrlRequest, GetInvoiceUrlResult>(functions, 'getInvoiceUrl')
const getCreditNoteUrlCallable = httpsCallable<GetCreditNoteUrlRequest, GetCreditNoteUrlResult>(
  functions,
  'getCreditNoteUrl',
)

/** Mints a fresh signed URL for a subOrder's GST invoice and opens it — the callable re-checks the caller is the buyer, the owning seller, or an admin (functions/src/tax/getInvoiceUrl.ts). */
export const getInvoiceUrl = (subOrderId: string) => getInvoiceUrlCallable({ subOrderId }).then((r) => r.data)

/** Same, for a credit note issued on a return. */
export const getCreditNoteUrl = (creditNoteId: string) =>
  getCreditNoteUrlCallable({ creditNoteId }).then((r) => r.data)

/** Maps a tax-document callable failure to an i18n key under `orders.tax.errors.*`. */
export function mapTaxActionErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'invoice_not_generated':
      return 'orders.tax.errors.invoiceNotGenerated'
    case 'invoice_not_found':
    case 'credit_note_not_found':
      return 'orders.tax.errors.notFound'
    case 'not_a_participant':
      return 'orders.errors.permissionDenied'
    default:
      return 'orders.errors.generic'
  }
}
