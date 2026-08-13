import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors ProductDetailPage's layout exactly so it never shifts when real data arrives. */
export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <Skeleton className="aspect-square w-full" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-16 w-16" />
          <Skeleton className="h-16 w-16" />
          <Skeleton className="h-16 w-16" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>

      <div className="space-y-3 md:col-span-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}
