import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useGarageVehicles } from '@/features/auth/api/garageVehicles'
import { cn } from '@/lib/utils'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

interface VehicleQuickSwitchSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * The persistent FitmentBar's "switch vehicle" affordance: a one-tap list of
 * the signed-in buyer's saved garage vehicles, plus "Add vehicle" (routes to
 * /garage, which now offers both manual selection and registration-number
 * lookup — see AddVehicleFlow). Deliberately separate from VehicleSelector
 * in the header: this only ever switches among *saved* vehicles.
 */
export function VehicleQuickSwitchSheet({ open, onClose }: VehicleQuickSwitchSheetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { vehicles, loading } = useGarageVehicles(user?.uid)
  const { activeVehicle, setActiveVehicle } = useActiveVehicleStore()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('vehicleQuickSwitch.title')}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-[6px] border-t border-steel/20 bg-surface p-4 md:inset-x-auto md:bottom-auto md:left-4 md:top-16 md:w-96 md:rounded-[6px] md:border"
      >
        <p className="mb-3 font-heading text-lg font-semibold text-ink">{t('vehicleQuickSwitch.title')}</p>

        {!user ? (
          <p className="mb-3 text-sm text-steel">{t('vehicleQuickSwitch.signInPrompt')}</p>
        ) : loading ? (
          <div className="mb-3 space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : vehicles.length === 0 ? (
          <p className="mb-3 text-sm text-steel">{t('vehicleQuickSwitch.empty')}</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {vehicles.map((vehicle) => {
              const isActive = activeVehicle?.garageVehicleId === vehicle.id
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVehicle({
                        garageVehicleId: vehicle.id,
                        makeId: vehicle.makeId,
                        makeName: vehicle.makeName,
                        modelId: vehicle.modelId,
                        modelName: vehicle.modelName,
                        variantId: vehicle.variantId,
                        variantName: vehicle.variantName,
                        year: vehicle.year,
                        fuelType: vehicle.fuelType,
                        nickname: vehicle.nickname,
                      })
                      onClose()
                    }}
                    className={cn(
                      'flex min-h-tap w-full items-center justify-between rounded-[6px] border px-4 py-3 text-left',
                      isActive ? 'border-signal bg-signal/5' : 'border-steel/20 hover:bg-surface-muted',
                    )}
                  >
                    <span>
                      <span className="block font-medium text-ink">
                        {vehicle.nickname || `${vehicle.makeName} ${vehicle.modelName}`}
                      </span>
                      <span className="block text-sm text-steel">
                        {vehicle.variantName}
                        {vehicle.year ? ` · ${vehicle.year}` : ''}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="shrink-0 text-xs font-medium text-verify">{t('garage.active')}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            onClose()
            navigate('/garage')
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('vehicleQuickSwitch.addVehicle')}
        </Button>
      </div>
    </>
  )
}
