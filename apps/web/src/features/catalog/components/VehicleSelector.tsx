import { Car, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useVehicleMakes, useVehicleModels, useVehicleVariants } from '@/features/auth/api/vehicleCatalog'
import { localVehicleId } from '@/features/catalog/lib/localVehicleId'
import { cn } from '@/lib/utils'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

type Step = 'make' | 'model' | 'variant' | 'year'

const STEP_ORDER: Step[] = ['make', 'model', 'variant', 'year']

/** Real vehicleMakes doc ids from the seed catalog — pinned at the top of the make list when present. Missing ids are silently ignored, so this stays safe against a different environment's dataset. */
const POPULAR_MAKE_IDS = [
  'maruti-suzuki',
  'hyundai',
  'tata-passenger',
  'mahindra',
  'honda',
  'hero',
  'bajaj',
  'honda-2w',
]

interface OptionListProps<T> {
  items: T[]
  getKey: (item: T) => string
  getLabel: (item: T) => string
  getLogoUrl?: (item: T) => string | undefined
  pinnedIds?: string[]
  onSelect: (item: T) => void
  searchPlaceholder: string
  emptyLabel: string
}

function OptionList<T>({
  items,
  getKey,
  getLabel,
  getLogoUrl,
  pinnedIds,
  onSelect,
  searchPlaceholder,
  emptyLabel,
}: OptionListProps<T>) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((item) => getLabel(item).toLowerCase().includes(q)) : items
  }, [items, search, getLabel])

  const pinned = useMemo(() => {
    if (!pinnedIds || search) return []
    return pinnedIds
      .map((id) => items.find((item) => getKey(item) === id))
      .filter((item): item is T => Boolean(item))
  }, [items, pinnedIds, search, getKey])

  const pinnedKeys = useMemo(() => new Set(pinned.map(getKey)), [pinned, getKey])
  const rest = filtered.filter((item) => !pinnedKeys.has(getKey(item)))

  const searchInputRef = useRef<HTMLInputElement>(null)
  // A fresh OptionList instance is mounted per selector step (see the
  // step === '...' ? <OptionList /> conditionals below), so this only runs
  // once per step change — the equivalent of autoFocus without the lint
  // rule's usability concerns around the JSX prop itself.
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-steel/10 p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface py-2 pl-9 pr-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-steel">{emptyLabel}</p>
        ) : (
          <>
            {pinned.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-b border-steel/10 p-3">
                {pinned.map((item) => (
                  <button
                    key={getKey(item)}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex min-h-tap items-center gap-2 rounded-[6px] border border-steel/20 bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted"
                  >
                    {getLogoUrl?.(item) ? (
                      <img src={getLogoUrl(item)} alt="" className="h-5 w-5 rounded-full object-contain" />
                    ) : (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-steel/10 text-[10px] font-semibold text-ink"
                        aria-hidden="true"
                      >
                        {getLabel(item).slice(0, 1)}
                      </span>
                    )}
                    {getLabel(item)}
                  </button>
                ))}
              </div>
            ) : null}

            {rest.length > 0 ? (
              <ul>
                {rest.map((item) => (
                  <li key={getKey(item)}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex min-h-tap w-full items-center justify-between px-4 py-3 text-left text-base text-ink hover:bg-surface-muted"
                    >
                      {getLabel(item)}
                      <ChevronRight className="h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : pinned.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-steel">{emptyLabel}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function OptionListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  )
}

/**
 * Cascading Make -> Model -> Variant/Fuel -> Year vehicle picker. Full-screen
 * sheet on mobile, anchored dropdown on desktop (md+) — same markup, styled
 * responsively, so there's one selection flow to maintain. Picking a year
 * sets the buyer's active vehicle (persisted by activeVehicleStore) but does
 * NOT save it to the buyer's garage — that's a deliberate separation from
 * "My Garage"/the quick-switch bar, see VehicleQuickSwitchSheet.
 */
export function VehicleSelector() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('make')
  const [pickedMakeId, setPickedMakeId] = useState<string>()
  const [pickedModelId, setPickedModelId] = useState<string>()
  const [pickedVariantId, setPickedVariantId] = useState<string>()

  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const setActiveVehicle = useActiveVehicleStore((state) => state.setActiveVehicle)

  const makesQuery = useVehicleMakes()
  const modelsQuery = useVehicleModels(pickedMakeId)
  const variantsQuery = useVehicleVariants(pickedMakeId, pickedModelId)

  const pickedMake = makesQuery.data?.find((make) => make.id === pickedMakeId)
  const pickedModel = modelsQuery.data?.find((model) => model.id === pickedModelId)
  const pickedVariant = variantsQuery.data?.find((variant) => variant.id === pickedVariantId)

  const yearOptions = useMemo(() => {
    if (!pickedVariant) return []
    const from = pickedVariant.yearFrom
    const to = pickedVariant.yearTo ?? new Date().getFullYear()
    const years: number[] = []
    for (let year = to; year >= from; year--) years.push(year)
    return years
  }, [pickedVariant])

  function reset() {
    setStep('make')
    setPickedMakeId(undefined)
    setPickedModelId(undefined)
    setPickedVariantId(undefined)
  }

  function close() {
    setOpen(false)
    reset()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close() only needs the current `open` value
  }, [open])

  function selectYear(year: number) {
    if (!pickedMake || !pickedModel || !pickedVariant) return
    setActiveVehicle({
      garageVehicleId: localVehicleId(pickedMake.id, pickedModel.id, pickedVariant.id, year),
      makeId: pickedMake.id,
      makeName: pickedMake.name,
      modelId: pickedModel.id,
      modelName: pickedModel.name,
      variantId: pickedVariant.id,
      variantName: pickedVariant.name,
      year,
      fuelType: pickedVariant.fuelType,
    })
    close()
  }

  const stepIndex = STEP_ORDER.indexOf(step)
  const triggerLabel = activeVehicle
    ? (activeVehicle.nickname ?? `${activeVehicle.makeName} ${activeVehicle.modelName}`)
    : t('vehicleSelector.trigger')

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="max-w-[11rem] justify-start gap-2 truncate sm:max-w-[16rem]"
      >
        <Car className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{triggerLabel}</span>
      </Button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('vehicleSelector.title')}
            className={cn(
              'fixed inset-0 z-50 flex flex-col bg-surface',
              'md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:h-[28rem] md:w-96',
              'md:rounded-[6px] md:border md:border-steel/20 md:shadow-lg',
            )}
          >
            <div className="flex items-center gap-1 border-b border-steel/10 p-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(STEP_ORDER[stepIndex - 1] as Step)}
                  aria-label={t('common.back')}
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null}
              <p className="flex-1 truncate font-heading text-lg font-semibold text-ink">
                {t(`vehicleSelector.step.${step}`)}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label={t('common.close')}
                className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {step === 'make' ? (
              makesQuery.isLoading ? (
                <OptionListSkeleton />
              ) : (
                <OptionList
                  items={makesQuery.data ?? []}
                  getKey={(make) => make.id}
                  getLabel={(make) => make.name}
                  getLogoUrl={(make) => make.logoUrl}
                  pinnedIds={POPULAR_MAKE_IDS}
                  searchPlaceholder={t('vehicleSelector.searchMake')}
                  emptyLabel={t('vehicleSelector.noResults')}
                  onSelect={(make) => {
                    setPickedMakeId(make.id)
                    setPickedModelId(undefined)
                    setPickedVariantId(undefined)
                    setStep('model')
                  }}
                />
              )
            ) : null}

            {step === 'model' ? (
              modelsQuery.isLoading ? (
                <OptionListSkeleton />
              ) : (
                <OptionList
                  items={modelsQuery.data ?? []}
                  getKey={(model) => model.id}
                  getLabel={(model) => model.name}
                  searchPlaceholder={t('vehicleSelector.searchModel')}
                  emptyLabel={t('vehicleSelector.noResults')}
                  onSelect={(model) => {
                    setPickedModelId(model.id)
                    setPickedVariantId(undefined)
                    setStep('variant')
                  }}
                />
              )
            ) : null}

            {step === 'variant' ? (
              variantsQuery.isLoading ? (
                <OptionListSkeleton />
              ) : (
                <OptionList
                  items={variantsQuery.data ?? []}
                  getKey={(variant) => variant.id}
                  getLabel={(variant) => `${variant.name} · ${t(`garage.fuelType.${variant.fuelType}`)}`}
                  searchPlaceholder={t('vehicleSelector.searchVariant')}
                  emptyLabel={t('vehicleSelector.noResults')}
                  onSelect={(variant) => {
                    setPickedVariantId(variant.id)
                    setStep('year')
                  }}
                />
              )
            ) : null}

            {step === 'year' ? (
              <OptionList
                items={yearOptions}
                getKey={(year) => String(year)}
                getLabel={(year) => String(year)}
                searchPlaceholder={t('vehicleSelector.searchYear')}
                emptyLabel={t('vehicleSelector.noResults')}
                onSelect={selectYear}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
