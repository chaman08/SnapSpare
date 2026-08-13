import { CATEGORY_TREE } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

interface VehicleMakeRow {
  id: string
  name: string
  slug: string
}

interface VehicleModelRow {
  id: string
  makeId: string
  name: string
  slug: string
  yearFrom: number
  yearTo?: number
}

/** Minimum matching active parts before a combo earns a generated page — below this, the page still works (CategoryPage renders generically) but stays noindex'd rather than diluting the site with thin content. */
const MIN_MATCHING_PARTS = 3
/** Sample of matched partIds kept on the doc for JSON-LD/"most bought" seeding — the live grid still queries search for the real, current listing set. */
const SAMPLE_PART_LIMIT = 6
/**
 * No real demand signal (search volume, order volume) exists yet to
 * prioritize which vehicle×category combinations are worth generating first
 * — see the Phase 22 README note. Deterministic ordering (models by name,
 * subcategories in CATEGORY_TREE order) at least means coverage grows the
 * same way every run rather than randomly, and these two caps keep one run
 * bounded regardless of how large the vehicle/catalogue master data grows.
 */
const MAX_MODELS_SCANNED = 60
const MAX_COMBOS_SCANNED = 3000
const MAX_PAGES_GENERATED = 400

function buildFaq(subcategoryName: string, makeName: string, modelName: string, yearFrom: number, yearTo: number | undefined) {
  const yearRange = yearTo ? `${yearFrom}–${yearTo}` : `${yearFrom} onward`
  return [
    {
      question: `Will these ${subcategoryName.toLowerCase()} fit my ${makeName} ${modelName}?`,
      answer: `Every listing shown here is fitment-checked against the ${makeName} ${modelName} (${yearRange}). Look for the "Fits" badge on each listing before ordering — SnapSpare flags any part that doesn't match your exact variant.`,
    },
    {
      question: 'How is the price calculated for bulk orders?',
      answer:
        'Every seller sets quantity-slab pricing — the per-unit price drops as you buy more. The listing page shows each price tier so mechanics and garages buying in bulk can see the exact savings before checkout.',
    },
    {
      question: 'Can I compare prices across multiple sellers?',
      answer: `Yes — the product page for each ${subcategoryName.toLowerCase()} shows every verified seller's price, delivery estimate and rating side by side.`,
    },
  ]
}

/**
 * Auto-generates long-tail SEO landing-page content (Phase 22 requirement 1
 * — "brake pads for Maruti Swift 2018 diesel") for every (subcategory ×
 * vehicle model) combination that has real inventory behind it, writing to
 * `seoLandingPages/{categorySlug}__{subcategorySlug}__{vehicleSlug}`. Reuses
 * `catalogPart.fitmentSummary.modelIds` (already denormalized onto every
 * catalog part by the fitment-write pipeline — see catalogPart.ts) instead
 * of joining `catalogFitments`, so counting matches per combo is one
 * `where(...).count()` aggregation query, not a join.
 *
 * The scan is capped (see the MAX_* constants above) rather than exhaustive
 * — at India-market scale (thousands of vehicle models) a real
 * implementation needs to prioritize combos by actual search/order demand,
 * which this phase has no signal source for yet. The hook point for that
 * upgrade is exactly here: swap the deterministic model/subcategory loop
 * order for a query against a future demand-ranked source (searchMisses,
 * order volume by partId×vehicleModelId) once one exists.
 */
export const generateSeoLandingPages = onSchedule(
  { region: 'asia-south1', schedule: 'every monday 03:00', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const db = getFirestore()

    const [makesSnap, modelsSnap] = await Promise.all([
      db.collection('vehicleMakes').where('status', '==', 'active').get(),
      db.collection('vehicleModels').where('status', '==', 'active').orderBy('name').limit(MAX_MODELS_SCANNED).get(),
    ])
    const makeById = new Map(makesSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() } as VehicleMakeRow]))
    const models = modelsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as VehicleModelRow)

    const now = Date.now()
    let combosScanned = 0
    let pagesGenerated = 0
    const writes: { id: string; doc: Record<string, unknown> }[] = []

    outer: for (const model of models) {
      const make = makeById.get(model.makeId)
      if (!make) continue

      for (const category of CATEGORY_TREE) {
        for (const sub of category.subcategories) {
          if (combosScanned >= MAX_COMBOS_SCANNED || pagesGenerated >= MAX_PAGES_GENERATED) break outer
          combosScanned += 1

          const baseQuery = db
            .collection('catalogParts')
            .where('categorySlug', '==', category.slug)
            .where('subcategorySlug', '==', sub.slug)
            .where('status', '==', 'active')
            .where('fitmentSummary.modelIds', 'array-contains', model.id)

          const countSnap = await baseQuery.count().get()
          const matchedPartCount = countSnap.data().count
          if (matchedPartCount < MIN_MATCHING_PARTS) continue

          const sampleSnap = await baseQuery.limit(SAMPLE_PART_LIMIT).get()
          const matchedPartIds = sampleSnap.docs.map((doc) => doc.id)

          const vehicleSlug = `${make.slug}-${model.slug}`
          const id = `${category.slug}__${sub.slug}__${vehicleSlug}`
          const yearRange = model.yearTo ? `${model.yearFrom}-${model.yearTo}` : `${model.yearFrom}+`

          writes.push({
            id,
            doc: {
              categorySlug: category.slug,
              categoryName: category.name,
              subcategorySlug: sub.slug,
              subcategoryName: sub.name,
              vehicleMakeId: make.id,
              vehicleModelId: model.id,
              vehicleSlug,
              makeName: make.name,
              modelName: model.name,
              yearFrom: model.yearFrom,
              yearTo: model.yearTo,
              title: `${sub.name} for ${make.name} ${model.name} (${yearRange}) — SnapSpare`,
              metaDescription: `Shop ${sub.name} for the ${make.name} ${model.name} — fitment-checked listings from verified sellers, priced by the quantity you need.`,
              h1: `${sub.name} for ${make.name} ${model.name}`,
              introText: `Every ${sub.name.toLowerCase()} listed here is checked against the ${make.name} ${model.name}'s fitment data before it's shown to you. Compare ${matchedPartCount} part${matchedPartCount === 1 ? '' : 's'} across verified sellers, with quantity-slab pricing for mechanics and garages buying in bulk.`,
              faq: buildFaq(sub.name, make.name, model.name, model.yearFrom, model.yearTo),
              matchedPartIds,
              matchedPartCount,
              generatedAt: now,
              updatedAt: now,
            },
          })
          pagesGenerated += 1
        }
      }
    }

    const batches: (typeof writes)[] = []
    for (let i = 0; i < writes.length; i += 400) batches.push(writes.slice(i, i + 400))
    for (const batchWrites of batches) {
      const batch = db.batch()
      for (const { id, doc } of batchWrites) {
        batch.set(db.collection('seoLandingPages').doc(id), doc, { merge: true })
      }
      await batch.commit()
    }

    logger.info('generateSeoLandingPages: done', { combosScanned, pagesGenerated })
  },
)
