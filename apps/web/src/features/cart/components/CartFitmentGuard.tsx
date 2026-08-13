import type { CartItem, FitmentStatus } from '@snapspare/shared'
import { AlertTriangle, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFitmentCheck } from '@/features/catalog/api/fitment'
import { useListing } from '@/features/catalog/api/listing'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

interface AffectedItem {
  listingId: string
  title: string
}

/**
 * Renders nothing but resolves one cart item's fitment + title and reports
 * it up — kept as its own component (rather than a loop of hook calls in
 * the parent) because React requires a stable component boundary per hook
 * call site when the item count varies render to render.
 */
function CartItemFitmentWatcher({
  item,
  onResult,
}: {
  item: CartItem
  onResult: (listingId: string, status: FitmentStatus, title: string) => void
}) {
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const { data } = useFitmentCheck(item.partId, activeVehicle)
  const listingQuery = useListing(item.listingId)
  const status = data?.status

  useEffect(() => {
    if (!status) return
    onResult(item.listingId, status, listingQuery.data?.title ?? item.listingId)
  }, [status, item.listingId, listingQuery.data?.title, onResult])

  return null
}

interface CartFitmentGuardProps {
  items: CartItem[]
}

/**
 * Cart guard (design spec item 6): if any line item doesn't fit the active
 * vehicle, surfaces a dismissible warning naming them — it never blocks
 * checkout, it only informs. Re-evaluates fresh on every cart load/vehicle
 * change (fitment can go stale between sessions), and un-dismisses itself
 * if the active vehicle changes so a stale dismissal doesn't hide a new
 * mismatch.
 */
export function CartFitmentGuard({ items }: CartFitmentGuardProps) {
  const { t } = useTranslation()
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const [affectedById, setAffectedById] = useState<Record<string, AffectedItem>>({})
  const [dismissed, setDismissed] = useState(false)

  const handleResult = useCallback((listingId: string, status: FitmentStatus, title: string) => {
    setAffectedById((prev) => {
      if (status !== 'does_not_fit') {
        if (!(listingId in prev)) return prev
        const { [listingId]: _removed, ...rest } = prev
        return rest
      }
      if (prev[listingId]?.title === title) return prev
      return { ...prev, [listingId]: { listingId, title } }
    })
  }, [])

  useEffect(() => {
    setDismissed(false)
    setAffectedById({})
  }, [activeVehicle?.garageVehicleId])

  const watchers = activeVehicle
    ? items.map((item) => (
        <CartItemFitmentWatcher key={item.listingId} item={item} onResult={handleResult} />
      ))
    : null

  const affected = Object.values(affectedById)

  if (!activeVehicle || affected.length === 0 || dismissed) {
    return <>{watchers}</>
  }

  return (
    <>
      {watchers}
      <div
        role="alert"
        aria-live="polite"
        className="flex items-start gap-3 rounded-[6px] border border-alert/30 bg-alert/5 p-4"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alert" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-medium text-alert">{t('cart.fitmentGuard.title')}</p>
          <ul className="list-inside list-disc text-sm text-ink">
            {affected.map((item) => (
              <li key={item.listingId} className="truncate">
                {item.title}
              </li>
            ))}
          </ul>
          <p className="text-sm text-steel">{t('cart.fitmentGuard.description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('cart.fitmentGuard.dismiss')}
          className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-[6px] text-steel hover:bg-alert/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  )
}
