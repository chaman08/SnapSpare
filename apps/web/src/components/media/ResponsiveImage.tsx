import { useState } from 'react'
import { cn } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { buildResizedUrl, buildSrcSet } from './resizedImageUrl'

interface ResponsiveImageProps {
  src: string
  alt: string
  /** Intrinsic width/height in px — required so the browser can reserve layout space before the image loads (eliminates CLS). */
  width: number
  height: number
  sizes?: string
  className?: string
  /** Applied to the aspect-ratio wrapper div — for a fallback background color, extra rounding, etc. */
  wrapperClassName?: string
  /** Above-the-fold images (hero, first product row) should load eagerly and skip the blur placeholder fade-in. */
  priority?: boolean
}

/**
 * Shared image renderer for every product/brand/category image in the app —
 * responsive srcset against the Resize Images extension's generated
 * variants, explicit width/height (CLS), lazy loading below the fold, and a
 * blurred low-res placeholder (LQIP) that fades out once the full image
 * loads. Respects low-data mode by capping the requested size and skipping
 * the extra placeholder request entirely.
 */
export function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  className,
  wrapperClassName,
  priority = false,
}: ResponsiveImageProps) {
  const lowDataMode = usePreferencesStore((s) => s.lowDataMode)
  const [loaded, setLoaded] = useState(false)

  const srcSet = lowDataMode ? undefined : buildSrcSet(src)
  // Low-data mode: request only the smallest generated variant instead of the original full-resolution upload.
  const mainSrc = lowDataMode ? (buildResizedUrl(src, 200) ?? src) : src
  const placeholderSrc = !priority && !lowDataMode ? buildResizedUrl(src, 200) : null

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)} style={{ aspectRatio: `${width} / ${height}` }}>
      {placeholderSrc ? (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full scale-110 object-cover blur-lg transition-opacity duration-300',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      ) : null}
      <img
        src={mainSrc}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        className={cn('relative h-full w-full object-cover', className)}
      />
    </div>
  )
}
