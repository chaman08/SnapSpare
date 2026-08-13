/**
 * A query "looks like a part number" when it's a single alphanumeric token
 * (letters/digits with optional `-` or `/` separators), contains at least
 * one digit, and has no spaces — e.g. "GB-000123", "0K30A13700", "51713-A".
 * Used to decide whether to search `oemNumbers`/`crossRefNumbers` exactly
 * first and show an "Exact match" banner, both in the web search box and by
 * anything else that wants the same heuristic (kept here so client and
 * functions never drift apart).
 */
const PART_NUMBER_TOKEN = /^[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*$/

export function looksLikePartNumber(query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.length < 4 || trimmed.length > 32) return false
  if (/\s/.test(trimmed)) return false
  if (!/\d/.test(trimmed)) return false
  return PART_NUMBER_TOKEN.test(trimmed)
}
