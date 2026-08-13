import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { GripVertical, Loader2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { storage } from '@/lib/firebase'

const MAX_IMAGES = 8

interface ImageUploaderProps {
  sellerId: string
  /** Real listingId once one exists (edit mode), or a stable client-generated token for a not-yet-saved listing — either way it's just a Storage path segment, unrelated to the eventual Firestore doc id (see storage.rules' sellers/{sellerId}/listings/{allPaths=**} wildcard). */
  pathToken: string
  images: string[]
  onChange: (images: string[]) => void
}

/** Multi-image upload with drag-handle reorder (dnd-kit, keyboard-operable) — client-compresses to the 5MB cap, uploads, and stores download URLs (listingSchema.images is `z.array(z.string().url())`, not storage paths). */
export function ImageUploader({ sellerId, pathToken, images, onChange }: ImageUploaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setError(false)
    setUploading(true)
    try {
      const remaining = Math.max(0, MAX_IMAGES - images.length)
      const uploaded: string[] = []
      for (const file of files.slice(0, remaining)) {
        const compressed = await compressImageIfNeeded(file)
        const path = `sellers/${sellerId}/listings/${pathToken}/${Date.now()}-${compressed.name}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, compressed)
        uploaded.push(await getDownloadURL(storageRef))
      }
      onChange([...images, ...uploaded])
    } catch {
      setError(true)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleRemove(url: string) {
    onChange(images.filter((image) => image !== url))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = images.indexOf(String(active.id))
    const newIndex = images.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(images, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{t('sellerListings.addFlow.images.title')}</p>

      {images.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={verticalListSortingStrategy}>
            <ul className="grid grid-cols-2 gap-2 xs:grid-cols-3">
              {images.map((url) => (
                <SortableImage key={url} url={url} onRemove={() => handleRemove(url)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleFilesSelected}
        aria-label={t('sellerListings.addFlow.images.add')}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading || images.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="h-4 w-4" aria-hidden="true" />
        )}
        {uploading ? t('sellerListings.addFlow.images.uploading') : t('sellerListings.addFlow.images.add')}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {t('common.somethingWentWrong')}
        </p>
      ) : null}
    </div>
  )
}

function SortableImage({ url, onRemove }: { url: string; onRemove: () => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group relative overflow-hidden rounded-[6px] border border-steel/20 bg-surface"
    >
      <img src={url} alt="" className="aspect-square w-full object-cover" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 flex min-h-tap min-w-tap items-center justify-center rounded-[6px] bg-ink/60 text-surface opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal group-hover:opacity-100"
        aria-label={t('sellerListings.addFlow.images.reorder')}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex min-h-tap min-w-tap items-center justify-center rounded-[6px] bg-ink/60 text-surface opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal group-hover:opacity-100"
        aria-label={t('sellerListings.addFlow.images.remove')}
        disabled={isDragging}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  )
}
