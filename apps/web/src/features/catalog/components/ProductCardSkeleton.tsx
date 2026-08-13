import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors ProductCard's layout exactly so results grids never shift when real data arrives. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[6px] border border-steel/20 bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </div>
    </div>
  )
}
