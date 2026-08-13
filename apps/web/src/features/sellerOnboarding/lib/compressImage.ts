export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_DIMENSION_PX = 1600
const JPEG_QUALITY = 0.82

/**
 * Client-side resize/re-encode before a Storage upload, per the "client-side
 * compression and a 5MB cap" requirement — no image-compression npm
 * dependency added for this, just canvas + toBlob (PDFs skip this entirely
 * and are only size-checked). Downscales to at most 1600px on the long edge
 * and re-encodes as JPEG; if that still doesn't fit under the cap, throws so
 * the caller can show a "file too large" message instead of silently
 * uploading something oversized.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('file_too_large')
    return file
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('unsupported_file_type')
  }

  if (file.size <= MAX_UPLOAD_BYTES) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unsupported')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('compression_failed')
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('file_too_large')

  const name = file.name.replace(/\.[^.]+$/, '.jpg')
  return new File([blob], name, { type: 'image/jpeg' })
}
