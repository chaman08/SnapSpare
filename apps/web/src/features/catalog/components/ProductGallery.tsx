import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface ProductGalleryProps {
  images: string[]
  alt: string
}

/** Main image + thumbnail strip. Falls back to a single empty tile (matching ProductCard's placeholder) when a part has no images yet. */
export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-[6px] bg-surface-muted" />
  }

  const active = images[Math.min(index, images.length - 1)]

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[6px] bg-surface-muted">
        <img src={active} alt={alt} className="h-full w-full object-cover" />
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              aria-label={t('product.detail.gallery.previous')}
              className="absolute left-2 top-1/2 flex min-h-tap min-w-tap -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm hover:bg-surface"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % images.length)}
              aria-label={t('product.detail.gallery.next')}
              className="absolute right-2 top-1/2 flex min-h-tap min-w-tap -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm hover:bg-surface"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t('product.detail.gallery.thumbnail', { index: i + 1 })}
              aria-current={i === index}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border-2',
                i === index ? 'border-signal' : 'border-transparent',
              )}
            >
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
