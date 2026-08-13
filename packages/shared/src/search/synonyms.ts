export interface SearchSynonymSet {
  id: string
  synonyms: string[]
}

/**
 * One-way-free (Typesense "multi-way") synonym sets pushed to the search
 * collection by the backfill script (see packages/seed/src/scripts) and kept
 * here so the collection setup is the single source of truth instead of a
 * copy living inside that script. Includes common Hinglish/spelling variants
 * buyers actually type.
 */
export const SEARCH_SYNONYM_SETS: SearchSynonymSet[] = [
  { id: 'brake-shoe-liner', synonyms: ['brake shoe', 'brake liner'] },
  { id: 'silencer-exhaust', synonyms: ['silencer', 'exhaust'] },
  { id: 'clutch-plate-disc', synonyms: ['clutch plate', 'clutch disc'] },
  { id: 'mobil-engine-oil', synonyms: ['mobil', 'engine oil'] },
  { id: 'battery-batri', synonyms: ['battery', 'batri'] },
  { id: 'tyre-tayar', synonyms: ['tyre', 'tayar', 'tire'] },
  { id: 'headlight-hedlight', synonyms: ['headlight', 'hedlight', 'head light'] },
  { id: 'bearing-bering', synonyms: ['bearing', 'bering'] },
  { id: 'spark-plug-plug', synonyms: ['spark plug', 'plug'] },
  { id: 'gaadi-vehicle', synonyms: ['gaadi', 'gadi', 'vehicle', 'car'] },
  { id: 'shocker-shock-absorber', synonyms: ['shocker', 'shock absorber'] },
  { id: 'self-starter-motor', synonyms: ['self', 'starter motor', 'self motor'] },
]
