import type { VehicleRegLookupResult } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GarageVehicleInput } from '@/features/auth/api/garageVehicles'
import { RegNumberLookupPanel } from '@/features/auth/components/RegNumberLookupPanel'
import { VehicleFormPanel } from '@/features/auth/components/VehicleFormPanel'
import { cn } from '@/lib/utils'

type Mode = 'manual' | 'reg'

interface AddVehicleFlowProps {
  onSubmit: (input: GarageVehicleInput) => Promise<void>
  onCancel: () => void
}

/**
 * "Add a vehicle" with two entry points: the cascading manual selector, or a
 * registration-number lookup whose guess the buyer must confirm/correct in
 * the same VehicleFormPanel before it's saved (see RegNumberLookupPanel's
 * doc comment — the lookup itself is mock/dev-only).
 */
export function AddVehicleFlow({ onSubmit, onCancel }: AddVehicleFlowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('manual')
  const [resolved, setResolved] = useState<VehicleRegLookupResult>()

  const tabs: Array<{ key: Mode; label: string }> = [
    { key: 'manual', label: t('vehicleAddFlow.tabManual') },
    { key: 'reg', label: t('vehicleAddFlow.tabReg') },
  ]

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t('vehicleAddFlow.title')} className="flex gap-1 border-b border-steel/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={mode === tab.key}
            onClick={() => {
              setMode(tab.key)
              setResolved(undefined)
            }}
            className={cn(
              'min-h-tap border-b-2 px-3 text-sm font-medium',
              mode === tab.key ? 'border-signal text-ink' : 'border-transparent text-steel',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'manual' ? <VehicleFormPanel onSubmit={onSubmit} onCancel={onCancel} /> : null}

      {mode === 'reg' && !resolved ? (
        <RegNumberLookupPanel onResolved={setResolved} onCancel={onCancel} />
      ) : null}

      {mode === 'reg' && resolved ? (
        <VehicleFormPanel
          note={t('vehicleAddFlow.confirmNote', { regNumber: resolved.regNumber })}
          initial={{
            makeId: resolved.makeId,
            makeName: resolved.makeName,
            modelId: resolved.modelId,
            modelName: resolved.modelName,
            variantId: resolved.variantId,
            variantName: resolved.variantName,
            fuelType: resolved.fuelType,
            year: resolved.year,
            registrationNumber: resolved.regNumber,
          }}
          onSubmit={onSubmit}
          onCancel={() => setResolved(undefined)}
        />
      ) : null}
    </div>
  )
}
