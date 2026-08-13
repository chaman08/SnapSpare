function csvField(value: string | number): string {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Minimal RFC-4180-ish CSV builder — no dependency needed for straight header+rows output. Every admin tax report (design brief item 7) shares this. */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.map(csvField).join(',')]
  for (const row of rows) lines.push(row.map(csvField).join(','))
  return lines.join('\n')
}

/** Rupees (2dp), not paise — every report's CSV is meant for a human/GST-portal audience. */
export function paiseToRupeesString(paise: number): string {
  return (paise / 100).toFixed(2)
}
