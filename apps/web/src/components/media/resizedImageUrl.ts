/**
 * Sizes the Firebase "Resize Images" extension is configured to generate
 * (see extensions/storage-resize-images.env's IMG_SIZES) — kept as a single
 * source of truth so ResponsiveImage's srcset always matches what actually
 * exists in Storage.
 */
export const RESIZED_IMAGE_WIDTHS = [200, 400, 800] as const
export type ResizedImageWidth = (typeof RESIZED_IMAGE_WIDTHS)[number]

const STORAGE_HOST = 'firebasestorage.googleapis.com'

/**
 * Firebase Storage download URLs look like
 * `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded-path>?alt=media&token=...`.
 * The Resize Images extension writes `<name>_<width>x<width>.webp` next to
 * the original in the same folder — this rebuilds that sibling path and
 * points at it directly, skipping the token query param (safe only because
 * these paths are already public-read in storage.rules; see
 * `sellers/{sellerId}/listings/{allPaths=**}`).
 *
 * Returns null for anything that isn't a recognisable Storage download URL
 * (a brand logo on some other host, a data: URI, etc.) — callers fall back
 * to rendering the original `src` with no srcset in that case.
 */
export function buildResizedUrl(originalUrl: string, width: ResizedImageWidth): string | null {
  let parsed: URL
  try {
    parsed = new URL(originalUrl)
  } catch {
    return null
  }
  if (parsed.hostname !== STORAGE_HOST) return null

  const match = parsed.pathname.match(/^(\/v0\/b\/[^/]+\/o\/)(.+)$/)
  const prefix = match?.[1]
  const encodedPath = match?.[2]
  if (!prefix || !encodedPath) return null

  const decodedPath = decodeURIComponent(encodedPath)
  const lastSlash = decodedPath.lastIndexOf('/')
  const dir = lastSlash === -1 ? '' : decodedPath.slice(0, lastSlash + 1)
  const filename = lastSlash === -1 ? decodedPath : decodedPath.slice(lastSlash + 1)
  const lastDot = filename.lastIndexOf('.')
  const basename = lastDot === -1 ? filename : filename.slice(0, lastDot)
  const resizedPath = `${dir}${basename}_${width}x${width}.webp`

  return `https://${STORAGE_HOST}${prefix}${encodeURIComponent(resizedPath)}?alt=media`
}

export function buildSrcSet(originalUrl: string): string | undefined {
  const entries = RESIZED_IMAGE_WIDTHS.map((width) => {
    const url = buildResizedUrl(originalUrl, width)
    return url ? `${url} ${width}w` : null
  }).filter((entry): entry is string => entry !== null)
  return entries.length > 0 ? entries.join(', ') : undefined
}
