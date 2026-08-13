import type { PartCondition, PartType } from '@snapspare/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'
import type { SearchFilters } from '../types'

const PART_TYPES: PartType[] = ['oem', 'oes', 'aftermarket', 'genuine']
const CONDITIONS: PartCondition[] = ['new', 'used', 'refurbished']
const RATING_OPTIONS = [4, 3, 2] as const
const WARRANTY_OPTIONS = [6, 12, 24] as const

interface FacetControlsProps {
  filters: SearchFilters
  facetCounts: Record<string, Record<string, number>>
  onChange: (next: SearchFilters) => void
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function FacetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-steel/10 py-4 first:pt-0 last:border-b-0">
      <legend className="mb-2 text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: () => void
  label: string
  count?: number
}) {
  return (
    <label className="flex min-h-tap cursor-pointer items-center justify-between gap-2 text-sm text-ink">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded-[4px] border-steel/40 text-signal focus-visible:ring-2 focus-visible:ring-signal"
        />
        {label}
      </span>
      {count !== undefined ? <span className="text-xs text-steel">{count}</span> : null}
    </label>
  )
}

/** Shared facet-editing body used by both FacetSidebar (desktop) and FilterSheet (mobile) — one implementation, two shells. */
export function FacetControls({ filters, facetCounts, onChange }: FacetControlsProps) {
  const { t } = useTranslation()
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const brandCounts = facetCounts.brand ?? {}
  const brandOptions = Object.keys(brandCounts).sort((a, b) => (brandCounts[b] ?? 0) - (brandCounts[a] ?? 0))

  return (
    <div>
      {activeVehicle ? (
        <FacetSection title={t('search.facets.fitment')}>
          <Checkbox
            checked={filters.fitsMyVehicle && Boolean(filters.vehicleModelId)}
            onChange={() =>
              onChange({
                ...filters,
                fitsMyVehicle: !filters.fitsMyVehicle,
                vehicleModelId: activeVehicle.modelId,
              })
            }
            label={t('search.facets.fitsMyVehicle', {
              vehicle: activeVehicle.nickname ?? `${activeVehicle.makeName} ${activeVehicle.modelName}`,
            })}
          />
        </FacetSection>
      ) : null}

      <FacetSection title={t('search.facets.availability')}>
        <Checkbox
          checked={filters.inStockOnly}
          onChange={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
          label={t('search.facets.inStockOnly')}
        />
        <Checkbox
          checked={filters.maxDeliveryEtaDays === 3}
          onChange={() =>
            onChange({ ...filters, maxDeliveryEtaDays: filters.maxDeliveryEtaDays === 3 ? undefined : 3 })
          }
          label={t('search.facets.fastDelivery')}
        />
      </FacetSection>

      {brandOptions.length > 0 ? (
        <FacetSection title={t('search.facets.brand')}>
          {brandOptions.map((brand) => (
            <Checkbox
              key={brand}
              checked={filters.brand.includes(brand)}
              onChange={() => onChange({ ...filters, brand: toggleInArray(filters.brand, brand) })}
              label={brand}
              count={brandCounts[brand]}
            />
          ))}
        </FacetSection>
      ) : null}

      <FacetSection title={t('search.facets.price')}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('search.facets.priceMin')}
            aria-label={t('search.facets.priceMin')}
            value={filters.priceMinPaise != null ? filters.priceMinPaise / 100 : ''}
            onChange={(event) =>
              onChange({
                ...filters,
                priceMinPaise: event.target.value ? Number(event.target.value) * 100 : undefined,
              })
            }
          />
          <span className="text-steel">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('search.facets.priceMax')}
            aria-label={t('search.facets.priceMax')}
            value={filters.priceMaxPaise != null ? filters.priceMaxPaise / 100 : ''}
            onChange={(event) =>
              onChange({
                ...filters,
                priceMaxPaise: event.target.value ? Number(event.target.value) * 100 : undefined,
              })
            }
          />
        </div>
      </FacetSection>

      <FacetSection title={t('search.facets.type')}>
        {PART_TYPES.map((type) => (
          <Checkbox
            key={type}
            checked={filters.type.includes(type)}
            onChange={() => onChange({ ...filters, type: toggleInArray(filters.type, type) })}
            label={t(`search.facets.partType.${type}`)}
            count={facetCounts.type?.[type]}
          />
        ))}
      </FacetSection>

      <FacetSection title={t('search.facets.condition')}>
        {CONDITIONS.map((condition) => (
          <Checkbox
            key={condition}
            checked={filters.condition.includes(condition)}
            onChange={() => onChange({ ...filters, condition: toggleInArray(filters.condition, condition) })}
            label={t(`search.facets.conditionOption.${condition}`)}
            count={facetCounts.condition?.[condition]}
          />
        ))}
      </FacetSection>

      <FacetSection title={t('search.facets.sellerRating')}>
        {RATING_OPTIONS.map((rating) => (
          <Checkbox
            key={rating}
            checked={filters.sellerRatingMin === rating}
            onChange={() =>
              onChange({ ...filters, sellerRatingMin: filters.sellerRatingMin === rating ? undefined : rating })
            }
            label={t('search.facets.ratingAndUp', { rating })}
          />
        ))}
      </FacetSection>

      <FacetSection title={t('search.facets.warranty')}>
        {WARRANTY_OPTIONS.map((months) => (
          <Checkbox
            key={months}
            checked={filters.warrantyMonthsMin === months}
            onChange={() =>
              onChange({
                ...filters,
                warrantyMonthsMin: filters.warrantyMonthsMin === months ? undefined : months,
              })
            }
            label={t('search.facets.warrantyMonths', { count: months })}
          />
        ))}
      </FacetSection>
    </div>
  )
}
