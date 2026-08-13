/**
 * Minimal RFC-4180-ish CSV parser for the admin bulk-import tools
 * (Catalogue, Fitment) — handles quoted fields, escaped `""` quotes, and
 * commas/newlines inside quotes. Not a general-purpose CSV library: no
 * streaming, no encoding detection. Fine for the admin-pasted/uploaded
 * files these tools expect (capped at a few hundred rows server-side).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row)
  }
  return rows
}

/** First row is the header; returns objects keyed by header, trimmed. */
export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  const [header, ...body] = rows
  if (!header) return []
  return body.map((row) => Object.fromEntries(header.map((key, i) => [key.trim(), (row[i] ?? '').trim()])))
}
