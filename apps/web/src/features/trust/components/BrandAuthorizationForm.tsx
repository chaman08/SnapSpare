import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  submitBrandAuthorization,
  uploadBrandAuthorizationDocument,
  useMyBrandAuthorizations,
} from '@/features/trust/api/brandAuthorizationActions'
import { cn } from '@/lib/utils'

interface BrandAuthorizationFormProps {
  sellerId: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-signal/10 text-signal',
  verified: 'bg-verify/10 text-verify',
  rejected: 'bg-alert/10 text-alert',
}

/** Seller-side upload of a brand-authorization document (design brief item 4: "Never award a badge without a document") — the only way a listing can ever earn the "Genuine part" badge, via admin review + onBrandAuthorizationWrite.ts. */
export function BrandAuthorizationForm({ sellerId }: BrandAuthorizationFormProps) {
  const { t } = useTranslation()
  const { authorizations, loading } = useMyBrandAuthorizations(sellerId)
  const [brandName, setBrandName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!brandName.trim() || !file) return
    setSubmitting(true)
    try {
      const documentUrl = await uploadBrandAuthorizationDocument(sellerId, file)
      await submitBrandAuthorization({ brandName: brandName.trim(), documentUrl })
      toast.success(t('trust.brandAuth.success'))
      setBrandName('')
      setFile(null)
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
      <div>
        <h3 className="font-heading text-base font-semibold text-ink">{t('trust.brandAuth.title')}</h3>
        <p className="text-sm text-steel">{t('trust.brandAuth.description')}</p>
      </div>

      {!loading && authorizations.length > 0 ? (
        <ul className="space-y-1.5">
          {authorizations.map((auth) => (
            <li key={auth.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">{auth.brandName}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[auth.status])}>
                {t(`trust.brandAuth.status.${auth.status}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-auth-name">{t('trust.brandAuth.brandNameLabel')}</Label>
          <Input id="brand-auth-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-auth-file">{t('trust.brandAuth.documentLabel')}</Label>
          <input
            id="brand-auth-file"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      <Button type="button" variant="cta" size="sm" disabled={submitting || !brandName.trim() || !file} onClick={handleSubmit}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {submitting ? t('common.loading') : t('trust.brandAuth.submit')}
      </Button>
    </div>
  )
}
