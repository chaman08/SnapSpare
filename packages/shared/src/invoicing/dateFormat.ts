/** DD/MM/YYYY (UTC) — the format both GST invoice PDFs and the NIC e-way bill JSON schema expect for document dates. */
export function formatDateDDMMYYYY(epochMs: number): string {
  const date = new Date(epochMs)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}
