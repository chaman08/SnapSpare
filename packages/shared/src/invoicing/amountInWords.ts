const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] as string
  const tens = TENS[Math.floor(n / 10)] as string
  const ones = n % 10
  return ones === 0 ? tens : `${tens} ${ONES[ones]}`
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const head = `${ONES[hundreds]} Hundred`
  return rest === 0 ? head : `${head} ${belowHundred(rest)}`
}

/**
 * Converts a nonnegative integer into Indian-numbering-system words
 * (thousand / lakh / crore, not the international million/billion grouping)
 * — the format GST invoices conventionally spell the total out in.
 */
export function numberToIndianWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('numberToIndianWords: value must be a nonnegative integer')
  }
  if (value === 0) return 'Zero'

  const crore = Math.floor(value / 1_00_00_000)
  const lakh = Math.floor((value % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((value % 1_00_000) / 1_000)
  const rest = value % 1_000

  const parts: string[] = []
  if (crore > 0) parts.push(`${belowThousand(crore)} Crore`)
  if (lakh > 0) parts.push(`${belowThousand(lakh)} Lakh`)
  if (thousand > 0) parts.push(`${belowThousand(thousand)} Thousand`)
  if (rest > 0) parts.push(belowThousand(rest))

  return parts.join(' ')
}

/**
 * "Rupees One Lakh Twenty Thousand Only" style declaration for a GST
 * invoice's total, from integer paise. Required on every tax invoice per
 * GST invoice rules (Rule 46).
 */
export function amountInWordsFromPaise(paise: number): string {
  const rupees = Math.floor(paise / 100)
  const remainderPaise = paise % 100
  const rupeeWords = `Rupees ${numberToIndianWords(rupees)}`
  if (remainderPaise === 0) return `${rupeeWords} Only`
  return `${rupeeWords} and ${numberToIndianWords(remainderPaise)} Paise Only`
}
