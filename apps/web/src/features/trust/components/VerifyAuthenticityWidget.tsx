import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { verifyPartAuthenticity } from '@/features/trust/api/authenticityActions'

interface VerifyAuthenticityWidgetProps {
  listingId: string
}

/** Design brief item 4's optional QR/hologram verification hook — a manual code-entry fallback for the scan endpoint (functions/src/trust/verifyPartAuthenticity.ts); no camera-scanning UI in this phase, see the plan's "deliberately left out". */
export function VerifyAuthenticityWidget({ listingId }: VerifyAuthenticityWidgetProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ valid: boolean; message?: string } | null>(null)

  async function handleCheck() {
    if (!code.trim()) return
    setChecking(true)
    setResult(null)
    try {
      const response = await verifyPartAuthenticity({ code: code.trim(), listingId })
      setResult(response)
    } catch {
      setResult({ valid: false, message: t('common.somethingWentWrong') })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-2 rounded-[6px] border border-steel/20 p-3">
      <p className="text-sm font-medium text-ink">{t('trust.authenticity.title')}</p>
      <p className="text-xs text-steel">{t('trust.authenticity.description')}</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('trust.authenticity.codePlaceholder')}
          className="min-h-tap flex-1 rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        <Button type="button" variant="outline" size="sm" disabled={checking || !code.trim()} onClick={handleCheck}>
          {checking ? t('common.loading') : t('trust.authenticity.check')}
        </Button>
      </div>
      {result ? (
        <div className={`flex items-center gap-1.5 text-sm ${result.valid ? 'text-verify' : 'text-alert'}`}>
          {result.valid ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
          <span>{result.message ?? (result.valid ? t('trust.authenticity.valid') : t('trust.authenticity.invalid'))}</span>
        </div>
      ) : null}
    </div>
  )
}
