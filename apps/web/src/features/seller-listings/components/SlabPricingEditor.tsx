import type { PricingTier } from '@snapspare/shared'
import { listingPricingSchema, tierValidationIssuesToFieldErrors } from '@snapspare/shared'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const MAX_PRICING_TIERS = 6

export interface SlabPricingValue {
  moq: number
  stepQty: number
  tiers: PricingTier[]
}

interface DraftRow {
  key: string
  maxQtyText: string
  priceText: string
}

function toDraftRows(tiers: PricingTier[]): DraftRow[] {
  return tiers.map((tier, index) => ({
    key: `row-${index}-${tier.minQty}`,
    maxQtyText: tier.maxQty === null ? '' : String(tier.maxQty),
    priceText: String(tier.unitPricePaise / 100),
  }))
}

/** Derives each row's minQty from position (moq-anchored, cascading off the previous row's maxQty) — the UI never lets a seller type a conflicting minQty, which structurally rules out the "gap"/"overlap" error class entirely rather than making sellers fix it after the fact. */
function deriveTiers(moq: number, rows: DraftRow[]): { tiers: PricingTier[]; minQtys: (number | null)[] } {
  const minQtys: (number | null)[] = []
  const tiers: PricingTier[] = []
  let nextMinQty: number | null = moq

  rows.forEach((row, index) => {
    minQtys.push(nextMinQty)
    const isLast = index === rows.length - 1
    const maxQty = isLast ? null : row.maxQtyText === '' ? null : Number(row.maxQtyText)
    const unitPricePaise = row.priceText === '' ? NaN : Math.round(Number(row.priceText) * 100)
    tiers.push({
      minQty: nextMinQty ?? 0,
      maxQty: maxQty !== null && Number.isFinite(maxQty) ? maxQty : null,
      unitPricePaise: Number.isFinite(unitPricePaise) ? unitPricePaise : 0,
    })
    nextMinQty = maxQty !== null && Number.isFinite(maxQty) ? maxQty + 1 : null
  })

  return { tiers, minQtys }
}

interface SlabPricingEditorProps {
  value: SlabPricingValue
  onChange: (value: SlabPricingValue) => void
  onValidityChange?: (valid: boolean) => void
  /** false for a buyer-group override editor (BuyerGroupPricingTabs) — group overrides share the listing's own moq/stepQty (see groupPricingSchema's header comment), only the per-tier prices differ, so those two inputs are shown read-only instead of editable in that context. */
  moqStepQtyEditable?: boolean
}

/**
 * Add/remove/reorder-with-drag-handles quantity-slab tier editor, live
 * zod-validated with inline human-readable errors (via
 * tierValidationIssuesToFieldErrors) and paired with `PriceLadderPreview`
 * for the buyer-facing view alongside it. `moq`/`stepQty` are top-level
 * inputs; each row edits only `maxQty` (last row is always open-ended) and
 * `unitPricePaise` — `minQty` is derived, not entered (see deriveTiers).
 */
export function SlabPricingEditor({ value, onChange, onValidityChange, moqStepQtyEditable = true }: SlabPricingEditorProps) {
  const { t } = useTranslation()
  const idPrefix = useId()
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(value.tiers))
  const [moqText, setMoqText] = useState(String(value.moq))
  const [stepQtyText, setStepQtyText] = useState(String(value.stepQty))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const moq = Number(moqText) || 0
  const stepQty = Number(stepQtyText) || 1
  const { tiers: derivedTiers, minQtys } = useMemo(() => deriveTiers(moq, rows), [moq, rows])

  const validation = useMemo(
    () => listingPricingSchema.safeParse({ moq, stepQty, tiers: derivedTiers }),
    [moq, stepQty, derivedTiers],
  )
  const fieldErrors = useMemo(
    () =>
      validation.success
        ? []
        : tierValidationIssuesToFieldErrors({ moq, stepQty, tiers: derivedTiers }, validation.error.issues),
    [validation, moq, stepQty, derivedTiers],
  )

  useEffect(() => {
    onChange({ moq, stepQty, tiers: derivedTiers })
    onValidityChange?.(validation.success)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange/onValidityChange are event callbacks, not reactive inputs; including them would re-fire on every parent render.
  }, [moq, stepQty, derivedTiers])

  function errorFor(path: string): string | undefined {
    const error = fieldErrors.find((e) => e.path === path)
    if (!error) return undefined
    return t(`sellerListings.pricingErrors.${error.code}`, { ...error.params, raw: error.raw })
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addTier() {
    if (rows.length >= MAX_PRICING_TIERS) return
    setRows((prev) => {
      const last = prev[prev.length - 1]
      const lastMinQty = minQtys[prev.length - 1] ?? moq
      // Force the previous last row to close at its own minQty (a 1-wide range the seller will widen) so a new open-ended row can follow it.
      const closedPrevious: DraftRow[] =
        last ? [...prev.slice(0, -1), { ...last, maxQtyText: String(lastMinQty) }] : prev
      return [...closedPrevious, { key: `row-new-${Date.now()}`, maxQtyText: '', priceText: last?.priceText ?? '' }]
    })
  }

  function removeTier(index: number) {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => r.key === active.id)
    const newIndex = rows.findIndex((r) => r.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setRows((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  return (
    <div className="space-y-4">
      {moqStepQtyEditable ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-moq`}>{t('sellerListings.pricingEditor.moqLabel')}</Label>
            <Input
              id={`${idPrefix}-moq`}
              type="number"
              min={1}
              inputMode="numeric"
              value={moqText}
              onChange={(e) => setMoqText(e.target.value)}
            />
            {errorFor('moq') ? <p role="alert" className="text-sm text-alert">{errorFor('moq')}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-stepQty`}>{t('sellerListings.pricingEditor.stepQtyLabel')}</Label>
            <Input
              id={`${idPrefix}-stepQty`}
              type="number"
              min={1}
              inputMode="numeric"
              value={stepQtyText}
              onChange={(e) => setStepQtyText(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-steel">
          {t('sellerListings.pricingEditor.sharesDefaultMoq', { moq, stepQty })}
        </p>
      )}

      <div className="space-y-2" role="table" aria-label={t('sellerListings.pricingEditor.title')}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            {rows.map((row, index) => (
              <TierRow
                key={row.key}
                row={row}
                index={index}
                isLast={index === rows.length - 1}
                minQty={minQtys[index] ?? null}
                minQtyError={errorFor(`tiers.${index}.minQty`)}
                maxQtyError={errorFor(`tiers.${index}.maxQty`)}
                priceError={errorFor(`tiers.${index}.unitPricePaise`)}
                canRemove={rows.length > 1}
                onChange={(patch) => updateRow(index, patch)}
                onRemove={() => removeTier(index)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={rows.length >= MAX_PRICING_TIERS}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('sellerListings.pricingEditor.addTier')}
      </Button>
    </div>
  )
}

interface TierRowProps {
  row: DraftRow
  index: number
  isLast: boolean
  minQty: number | null
  minQtyError?: string
  maxQtyError?: string
  priceError?: string
  canRemove: boolean
  onChange: (patch: Partial<DraftRow>) => void
  onRemove: () => void
}

function TierRow({ row, index, isLast, minQty, minQtyError, maxQtyError, priceError, canRemove, onChange, onRemove }: TierRowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="row"
      className={`rounded-[6px] border p-3 ${isDragging ? 'border-signal bg-signal/5' : 'border-steel/20'}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          aria-label={t('sellerListings.pricingEditor.reorderTier', { tierNumber: index + 1 })}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs">{t('sellerListings.pricingEditor.tierLabel', { tierNumber: index + 1 })}</Label>
            <p className="font-mono text-sm text-ink">
              {minQty ?? '—'}
              {' – '}
              {isLast ? t('sellerListings.pricingEditor.andAbove') : row.maxQtyText || '—'}
            </p>
            {minQtyError ? <p role="alert" className="text-xs text-alert">{minQtyError}</p> : null}
          </div>

          {!isLast ? (
            <div className="space-y-1">
              <Label htmlFor={`${row.key}-maxQty`} className="text-xs">
                {t('sellerListings.pricingEditor.endsAtLabel')}
              </Label>
              <Input
                id={`${row.key}-maxQty`}
                type="number"
                min={minQty ?? 1}
                inputMode="numeric"
                value={row.maxQtyText}
                onChange={(e) => onChange({ maxQtyText: e.target.value })}
              />
              {maxQtyError ? <p role="alert" className="text-xs text-alert">{maxQtyError}</p> : null}
            </div>
          ) : (
            <div />
          )}

          <div className="space-y-1">
            <Label htmlFor={`${row.key}-price`} className="text-xs">
              {t('sellerListings.pricingEditor.unitPriceLabel')}
            </Label>
            <Input
              id={`${row.key}-price`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.priceText}
              onChange={(e) => onChange({ priceText: e.target.value })}
            />
            {priceError ? <p role="alert" className="text-xs text-alert">{priceError}</p> : null}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={t('sellerListings.pricingEditor.removeTier', { tierNumber: index + 1 })}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
