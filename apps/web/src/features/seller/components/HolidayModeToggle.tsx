import type { SellerSettings } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setHolidayMode } from '@/features/seller/api/sellerSettingsActions'

interface HolidayModeToggleProps {
  initial: SellerSettings['holidayMode'] | undefined
}

/** Pauses every active listing while on, and only resumes ones it paused when turned back off — see setHolidayMode.ts. */
export function HolidayModeToggle({ initial }: HolidayModeToggleProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState(initial?.active ?? false)
  const [returnDate, setReturnDate] = useState('')
  const [reason, setReason] = useState(initial?.reason ?? '')
  const [saving, setSaving] = useState(false)

  async function handleToggle(next: boolean) {
    setSaving(true)
    try {
      const result = await setHolidayMode({
        active: next,
        returnDate: next && returnDate ? new Date(returnDate).getTime() : undefined,
        reason: next ? reason || undefined : undefined,
      })
      setActive(next)
      toast.success(
        next
          ? t('sellerSettings.holidayMode.pausedToast', { count: result.listingsAffected })
          : t('sellerSettings.holidayMode.resumedToast', { count: result.listingsAffected }),
      )
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerSettings.holidayMode.title')}</h2>
        <span className={active ? 'text-sm font-medium text-signal' : 'text-sm text-steel'}>
          {t(active ? 'sellerSettings.holidayMode.active' : 'sellerSettings.holidayMode.inactive')}
        </span>
      </div>
      <p className="text-sm text-steel">{t('sellerSettings.holidayMode.description')}</p>

      {!active ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="returnDate">{t('sellerSettings.holidayMode.returnDate')}</Label>
            <Input id="returnDate" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="holidayReason">{t('sellerSettings.holidayMode.reason')}</Label>
            <Input id="holidayReason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="button" variant="cta" onClick={() => handleToggle(true)} disabled={saving}>
            {saving ? t('common.loading') : t('sellerSettings.holidayMode.enable')}
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => handleToggle(false)} disabled={saving}>
          {saving ? t('common.loading') : t('sellerSettings.holidayMode.disable')}
        </Button>
      )}
    </section>
  )
}
