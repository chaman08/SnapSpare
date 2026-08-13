import { CheckCircle2, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { SellerDocumentType } from '@/features/sellerOnboarding/api/uploadDocument'
import { uploadSellerDocument } from '@/features/sellerOnboarding/api/uploadDocument'

interface DocumentUploadFieldProps {
  uid: string
  docType: SellerDocumentType
  label: string
  hint?: string
  required?: boolean
  storagePath?: string
  onUploaded: (storagePath: string) => void
}

/** One upload row for Step 5 — compresses (images), enforces the 5MB cap, uploads, and reports the resulting Storage path back to the wizard's form state. */
export function DocumentUploadField({
  uid,
  docType,
  label,
  hint,
  required,
  storagePath,
  onUploaded,
}: DocumentUploadFieldProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const fieldId = `doc-${docType}`

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setStatus('uploading')
    try {
      const path = await uploadSellerDocument(uid, docType, file)
      onUploaded(path)
      setStatus('idle')
    } catch {
      setStatus('error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1.5 rounded-[6px] border border-steel/20 p-3">
      <Label htmlFor={fieldId}>
        {label}
        {required ? <span className="text-alert"> *</span> : null}
      </Label>
      {hint ? <p className="text-xs text-steel">{hint}</p> : null}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id={fieldId}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={status === 'uploading'}>
          {status === 'uploading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {storagePath ? t('sell.wizard.documents.replace') : t('sell.wizard.documents.upload')}
        </Button>
        {storagePath ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-verify">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('sell.wizard.documents.uploaded')}
          </span>
        ) : null}
      </div>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-alert">
          {t('sell.wizard.documents.uploadError')}
        </p>
      ) : null}
    </div>
  )
}
