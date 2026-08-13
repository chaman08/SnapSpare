import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RfqForm, type RfqFormPrefillPart } from '@/features/rfq/components/RfqForm'

interface RfqDialogProps {
  open: boolean
  onClose: () => void
  defaultDescription?: string
  defaultCategorySlug?: string
  prefillPart?: RfqFormPrefillPart
}

/** Shared modal wrapper for the two dialog-based RFQ entry points (zero-result search, product page "Get a quote") — the standalone /rfq/new page renders RfqForm full-page instead. */
export function RfqDialog({ open, onClose, defaultDescription, defaultCategorySlug, prefillPart }: RfqDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('rfq.form.dialogTitle')}</DialogTitle>
        </DialogHeader>
        <RfqForm
          defaultDescription={defaultDescription}
          defaultCategorySlug={defaultCategorySlug}
          prefillPart={prefillPart}
          onCreated={(result) => {
            onClose()
            navigate(`/rfq/${result.rfqId}`)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
