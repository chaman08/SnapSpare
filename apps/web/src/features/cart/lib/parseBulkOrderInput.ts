import type { BulkOrderPadRowInput, BulkOrderUnmatchedRow } from '@snapspare/shared'

export interface ParsedBulkOrderInput {
  rows: BulkOrderPadRowInput[]
  invalidRows: BulkOrderUnmatchedRow[]
}

/**
 * Parses pasted text or an uploaded CSV's contents into `{ query, qty }`
 * rows for resolveBulkOrder (design spec item 10). One line per part:
 * "OEM123, 10" (comma-separated, also accepts plain whitespace) or a CSV row
 * of the same shape. A first line that doesn't end in a number is treated as
 * a header ("Part Number, Qty") and skipped rather than reported as invalid.
 * Rows that still don't parse are returned separately so the pad can show
 * "couldn't read this line" without ever calling the server for them.
 */
export function parseBulkOrderInput(text: string): ParsedBulkOrderInput {
  const rows: BulkOrderPadRowInput[] = []
  const invalidRows: BulkOrderUnmatchedRow[] = []

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  lines.forEach((line, index) => {
    let parts = line
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length < 2) {
      const wsParts = line.split(/\s+/).filter(Boolean)
      if (wsParts.length >= 2) {
        parts = [wsParts.slice(0, -1).join(' '), wsParts[wsParts.length - 1] as string]
      }
    }

    if (parts.length < 2) {
      invalidRows.push({ raw: line, query: line, reason: 'invalid_row' })
      return
    }

    const qtyRaw = parts[parts.length - 1] as string
    const query = parts.slice(0, -1).join(', ')
    const qty = Number(qtyRaw)

    if (index === 0 && !Number.isFinite(qty)) {
      return // header row — skipped, not reported as an error
    }

    if (!query || !Number.isInteger(qty) || qty <= 0) {
      invalidRows.push({ raw: line, query: query || line, reason: 'invalid_row' })
      return
    }

    rows.push({ raw: line, query, qty })
  })

  return { rows, invalidRows }
}
