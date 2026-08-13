// Builds the list of paths build:prerender snapshots to static HTML (see
// prerender.mjs). Static pages (home, categories, category/subcategory
// browse) need no Firestore access and are always included. Everything
// else — vehicle hubs, auto-generated long-tail landing pages, top
// products, brands, stores — is read from Firestore via firebase-admin, so
// it needs real credentials: either GOOGLE_APPLICATION_CREDENTIALS pointing
// at a service account, or `gcloud auth application-default login`. When
// neither is configured (e.g. a contributor's local machine), this script
// logs a warning and falls back to the static-only list instead of failing
// the build — a smaller prerendered set is a much better failure mode than
// a broken `pnpm build`.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CATEGORY_TREE } from '@snapspare/shared'

const OUTPUT_PATH = fileURLToPath(new URL('./prerender-urls.json', import.meta.url))

const TOP_VEHICLE_MODELS = 30
const TOP_LANDING_PAGES = 50
const TOP_PRODUCTS = 50
const TOP_BRANDS = 30
const TOP_STORES = 30

function staticPaths() {
  const paths = ['/', '/categories']
  for (const category of CATEGORY_TREE) {
    paths.push(`/parts/${category.slug}`)
    for (const sub of category.subcategories) {
      paths.push(`/parts/${category.slug}/${sub.slug}`)
    }
  }
  return paths
}

async function firestorePaths() {
  let admin
  try {
    admin = await import('firebase-admin')
  } catch {
    console.warn('[prerender] firebase-admin not installed — skipping Firestore-backed pages.')
    return []
  }

  try {
    if (admin.apps === undefined || admin.apps.length === 0) {
      admin.initializeApp()
    }
  } catch (error) {
    console.warn('[prerender] Could not initialize firebase-admin (no credentials configured?) — skipping Firestore-backed pages.', error.message)
    return []
  }

  const db = admin.firestore()
  const paths = []

  try {
    const [makesSnap, modelsSnap, landingSnap, partsSnap, brandsSnap, storesSnap] = await Promise.all([
      db.collection('vehicleMakes').where('status', '==', 'active').get(),
      db.collection('vehicleModels').where('status', '==', 'active').orderBy('name').limit(TOP_VEHICLE_MODELS).get(),
      db.collection('seoLandingPages').orderBy('matchedPartCount', 'desc').limit(TOP_LANDING_PAGES).get(),
      db.collection('catalogParts').where('status', '==', 'active').orderBy('ratingBayesian', 'desc').limit(TOP_PRODUCTS).get(),
      db.collection('brands').where('status', '==', 'active').limit(TOP_BRANDS).get(),
      db.collection('storeSlugReservations').limit(TOP_STORES).get(),
    ])

    const makeById = new Map(makesSnap.docs.map((doc) => [doc.id, doc.data()]))
    for (const doc of modelsSnap.docs) {
      const model = doc.data()
      const make = makeById.get(model.makeId)
      if (make) paths.push(`/vehicle/${make.slug}/${model.slug}/${model.yearFrom}`)
    }

    for (const doc of landingSnap.docs) {
      const page = doc.data()
      paths.push(`/parts/${page.categorySlug}/${page.subcategorySlug ?? 'all'}/${page.vehicleSlug}`)
    }

    for (const doc of partsSnap.docs) {
      const part = doc.data()
      const slug = part.slug ?? part.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      paths.push(`/parts/p/${slug}-${doc.id}`)
    }

    for (const doc of brandsSnap.docs) {
      const brand = doc.data()
      if (brand.slug) paths.push(`/brand/${brand.slug}`)
    }

    for (const doc of storesSnap.docs) {
      paths.push(`/store/${doc.id}`)
    }
  } catch (error) {
    console.warn('[prerender] Firestore read failed — continuing with whatever paths were already collected.', error.message)
  }

  return paths
}

const paths = [...staticPaths(), ...(await firestorePaths())]
const uniquePaths = Array.from(new Set(paths))

await writeFile(OUTPUT_PATH, JSON.stringify(uniquePaths, null, 2))
console.log(`[prerender] Wrote ${uniquePaths.length} URLs to ${OUTPUT_PATH}`)
