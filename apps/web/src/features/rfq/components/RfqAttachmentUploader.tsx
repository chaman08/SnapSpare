import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { Loader2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { storage } from '@/lib/firebase'

const MAX_ATTACHMENTS = 6

interface RfqAttachmentUploaderProps {
  buyerUid: string
  pathToken: string
  images: string[]
  onChange: (images: string[]) => void
}

/** Photo upload for an RFQ's "free text + image" part identification (requirement 1). Simpler than seller-listings' ImageUploader — no drag-reorder, since attachment order isn't meaningful here — same client-side compression and storage.rules path convention (`rfqs/{buyerUid}/...`). */
export function RfqAttachmentUploader({ buyerUid, pathToken, images, onChange }: RfqAttachmentUploaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(false)

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setError(false)
    setUploading(true)
    try {
      const remaining = Math.max(0, MAX_ATTACHMENTS - images.length)
      const uploaded: string[] = []
      for (const file of files.slice(0, remaining)) {
        const compressed = await compressImageIfNeeded(file)
        const path = `rfqs/${buyerUid}/${pathToken}/${Date.now()}-${compressed.name}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, compressed)
        uploaded.push(await getDownloadURL(storageRef))
      }
      onChange([...images, ...uploaded])
    } catch {
      setError(true)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleRemove(url: string) {
    onChange(images.filter((image) => image !== url))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{t('rfq.form.attachments')}</p>

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((url) => (
            <li key={url} className="group relative overflow-hidden rounded-[6px] border border-steel/20 bg-surface">
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label={t('common.remove')}
                className="absolute right-1 top-1 flex min-h-tap min-w-tap items-center justify-center rounded-[6px] bg-ink/60 text-surface opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal group-hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleFilesSelected}
        aria-label={t('rfq.form.addAttachment')}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading || images.length >= MAX_ATTACHMENTS}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        {uploading ? t('common.loading') : t('rfq.form.addAttachment')}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {t('common.somethingWentWrong')}
        </p>
      ) : null}
    </div>
  )
}
