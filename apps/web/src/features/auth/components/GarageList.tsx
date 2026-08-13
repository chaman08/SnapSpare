import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import {
  addGarageVehicle,
  deleteGarageVehicle,
  useGarageVehicles,
} from '@/features/auth/api/garageVehicles'
import { AddVehicleFlow } from '@/features/auth/components/AddVehicleFlow'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'
import { useOfflineCacheStore } from '@/stores/offlineCacheStore'

export function GarageList({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const { vehicles, loading, error } = useGarageVehicles(userId)
  const [adding, setAdding] = useState(false)
  const { activeVehicle, setActiveVehicle } = useActiveVehicleStore()
  const setGarageCache = useOfflineCacheStore((s) => s.setGarageVehicles)

  useEffect(() => {
    if (loading || error) return
    setGarageCache(
      vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.nickname ?? `${vehicle.makeName} ${vehicle.modelName}`,
      })),
    )
  }, [vehicles, loading, error, setGarageCache])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState onRetry={() => window.location.reload()} />
  }

  if (adding) {
    return (
      <AddVehicleFlow
        onCancel={() => setAdding(false)}
        onSubmit={async (input) => {
          await addGarageVehicle(userId, input)
          toast.success(t('garage.saved'))
          setAdding(false)
        }}
      />
    )
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title={t('garage.emptyTitle')}
        description={t('garage.emptyDescription')}
        actionLabel={t('garage.addVehicle')}
        onAction={() => setAdding(true)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {vehicles.map((vehicle) => {
          const isActive = activeVehicle?.garageVehicleId === vehicle.id
          return (
            <li key={vehicle.id} className="rounded-[6px] border border-steel/20 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">
                    {vehicle.nickname || `${vehicle.makeName} ${vehicle.modelName}`}
                    {isActive ? (
                      <span className="ml-2 rounded-[6px] bg-verify/10 px-2 py-0.5 text-xs font-medium text-verify">
                        {t('garage.active')}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-steel">
                    {vehicle.makeName} {vehicle.modelName} · {vehicle.variantName}
                    {vehicle.year ? ` · ${vehicle.year}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
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
                    }
                  >
                    {t('garage.setActive')}
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm(t('garage.confirmDelete'))) return
                    await deleteGarageVehicle(userId, vehicle.id)
                    if (isActive) setActiveVehicle(null)
                    toast.success(t('garage.deleted'))
                  }}
                >
                  {t('garage.delete')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <Button variant="outline" onClick={() => setAdding(true)}>
        {t('garage.addVehicle')}
      </Button>
    </div>
  )
}
