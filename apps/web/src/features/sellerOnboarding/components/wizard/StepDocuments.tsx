import type { SellerApplication } from '@snapspare/shared'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveSellerApplicationStep } from '@/features/sellerOnboarding/api/sellerApplication'
import { uploadSellerDocument } from '@/features/sellerOnboarding/api/uploadDocument'
import { DocumentUploadField } from '@/features/sellerOnboarding/components/DocumentUploadField'

interface StepDocumentsProps {
  uid: string
  status: SellerApplication['status'] | undefined
  gstRegistered: boolean
  initial: SellerApplication['documents'] | undefined
  onSaved: () => void
  onBack: () => void
}

export function StepDocuments({ uid, status, gstRegistered, initial, onSaved, onBack }: StepDocumentsProps) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState({
    gstCertificateStoragePath: initial?.gstCertificateStoragePath,
    panStoragePath: initial?.panStoragePath,
    addressProofStoragePath: initial?.addressProofStoragePath,
    brandAuthLetterStoragePaths: initial?.brandAuthLetterStoragePaths ?? [],
    shopPhotoStoragePath: initial?.shopPhotoStoragePath,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brandAuthUploading, setBrandAuthUploading] = useState(false)
  const brandAuthInputRef = useRef<HTMLInputElement>(null)

  const canContinue =
    (!gstRegistered || Boolean(documents.gstCertificateStoragePath)) &&
    Boolean(documents.panStoragePath) &&
    Boolean(documents.addressProofStoragePath) &&
    Boolean(documents.shopPhotoStoragePath)

  async function handleBrandAuthFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBrandAuthUploading(true)
    try {
      const path = await uploadSellerDocument(uid, 'brand-auth', file)
      setDocuments((d) => ({ ...d, brandAuthLetterStoragePaths: [...d.brandAuthLetterStoragePaths, path] }))
    } finally {
      setBrandAuthUploading(false)
      event.target.value = ''
    }
  }

  function removeBrandAuth(index: number) {
    setDocuments((d) => ({ ...d, brandAuthLetterStoragePaths: d.brandAuthLetterStoragePaths.filter((_, i) => i !== index) }))
  }

  async function handleContinue() {
    if (!canContinue) {
      setError(t('sell.wizard.documents.incomplete'))
      return
    }
    setIsSubmitting(true)
    try {
      await saveSellerApplicationStep(uid, status, { currentStep: 6, documents })
      onSaved()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">{t('sell.wizard.documents.intro')}</p>

      {gstRegistered ? (
        <DocumentUploadField
          uid={uid}
          docType="gst-certificate"
          label={t('sell.wizard.documents.gstCertificate')}
          required
          storagePath={documents.gstCertificateStoragePath}
          onUploaded={(path) => setDocuments((d) => ({ ...d, gstCertificateStoragePath: path }))}
        />
      ) : null}

      <DocumentUploadField
        uid={uid}
        docType="pan"
        label={t('sell.wizard.documents.pan')}
        required
        storagePath={documents.panStoragePath}
        onUploaded={(path) => setDocuments((d) => ({ ...d, panStoragePath: path }))}
      />

      <DocumentUploadField
        uid={uid}
        docType="address-proof"
        label={t('sell.wizard.documents.addressProof')}
        hint={t('sell.wizard.documents.addressProofHint')}
        required
        storagePath={documents.addressProofStoragePath}
        onUploaded={(path) => setDocuments((d) => ({ ...d, addressProofStoragePath: path }))}
      />

      <DocumentUploadField
        uid={uid}
        docType="shop-photo"
        label={t('sell.wizard.documents.shopPhoto')}
        required
        storagePath={documents.shopPhotoStoragePath}
        onUploaded={(path) => setDocuments((d) => ({ ...d, shopPhotoStoragePath: path }))}
      />

      <div className="space-y-2 rounded-[6px] border border-steel/20 p-3">
        <p className="text-sm font-medium text-ink">{t('sell.wizard.documents.brandAuth')}</p>
        <p className="text-xs text-steel">{t('sell.wizard.documents.brandAuthHint')}</p>
        <ul className="space-y-1">
          {documents.brandAuthLetterStoragePaths.map((path, index) => (
            <li key={path} className="flex items-center justify-between text-xs text-verify">
              <span>{t('sell.wizard.documents.uploaded')} #{index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeBrandAuth(index)} aria-label={t('sell.wizard.addresses.removePickup')}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <input
          ref={brandAuthInputRef}
          type="file"
          className="sr-only"
          accept="image/*,application/pdf"
          onChange={handleBrandAuthFile}
        />
        <Button type="button" variant="outline" size="sm" disabled={brandAuthUploading} onClick={() => brandAuthInputRef.current?.click()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('sell.wizard.documents.addBrandAuth')}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          {t('sell.wizard.back')}
        </Button>
        <Button type="button" variant="cta" className="flex-1" onClick={handleContinue} disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('sell.wizard.continue')}
        </Button>
      </div>
    </div>
  )
}
