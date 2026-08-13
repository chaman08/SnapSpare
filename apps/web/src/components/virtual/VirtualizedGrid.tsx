import { type ReactNode, useEffect, useRef } from 'react'
import { FixedSizeList, type ListOnItemsRenderedProps } from 'react-window'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useResponsiveColumns } from './useResponsiveColumns'

interface VirtualizedGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  /** Columns at base/sm/lg breakpoints — pass the same numbers used by the CSS grid this replaces. */
  columns: { base: number; sm: number; lg: number }
  rowHeight: number
  gap?: number
  height: number
  /** Below this item count, render a plain (non-virtualized) grid instead — virtualization only pays off for long lists, and a fixed-height scroll region is worse UX for a handful of results. */
  virtualizeThreshold?: number
  onEndReached?: () => void
  /** Fire onEndReached this many rows before the actual end, to fetch the next page ahead of the buyer scrolling into it. */
  endReachedRowThreshold?: number
  className?: string
  gridClassName?: string
}

/**
 * Windowed replacement for a `grid-cols-N` CSS grid of same-height cards —
 * used by SearchResultsGrid, where a long infinite-scroll session used to
 * grow the DOM without bound. Each react-window "row" renders one row's
 * worth of grid items so a normal CSS grid can still lay them out
 * horizontally; only rendered rows exist in the DOM.
 */
export function VirtualizedGrid<T>({
  items,
  renderItem,
  columns: columnsConfig,
  rowHeight,
  gap = 12,
  height,
  virtualizeThreshold = 24,
  onEndReached,
  endReachedRowThreshold = 2,
  className,
  gridClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}: VirtualizedGridProps<T>) {
  const columns = useResponsiveColumns(columnsConfig.base, columnsConfig.sm, columnsConfig.lg)
  const rowCount = Math.ceil(items.length / columns)
  const calledEndReachedRef = useRef(false)
  const lowDataMode = usePreferencesStore((s) => s.lowDataMode)
  // Low-data mode: only fetch the next page once the sentinel is actually on
  // screen (and don't pre-render rows the buyer hasn't scrolled to yet)
  // instead of speculatively loading ~400px/1 row ahead of the viewport.
  const prefetchRootMargin = lowDataMode ? '0px' : '400px'
  const overscanRowCount = lowDataMode ? 0 : 1

  useEffect(() => {
    calledEndReachedRef.current = false
  }, [items.length])

  if (items.length <= virtualizeThreshold) {
    return (
      <PlainGrid
        className={className}
        gridClassName={gridClassName}
        onEndReached={onEndReached}
        rootMargin={prefetchRootMargin}
      >
        {items.map((item, index) => renderItem(item, index))}
      </PlainGrid>
    )
  }

  function handleItemsRendered({ visibleStopIndex }: ListOnItemsRenderedProps) {
    if (!onEndReached || calledEndReachedRef.current) return
    if (visibleStopIndex >= rowCount - 1 - endReachedRowThreshold) {
      calledEndReachedRef.current = true
      onEndReached()
    }
  }

  return (
    <FixedSizeList
      className={className}
      height={height}
      width="100%"
      itemCount={rowCount}
      itemSize={rowHeight + gap}
      overscanCount={overscanRowCount}
      onItemsRendered={handleItemsRendered}
    >
      {({ index, style }) => {
        const start = index * columns
        const rowItems = items.slice(start, start + columns)
        return (
          <div style={style}>
            <div className={`grid gap-3 ${gridClassName}`}>
              {rowItems.map((item, i) => renderItem(item, start + i))}
            </div>
          </div>
        )
      }}
    </FixedSizeList>
  )
}

/** Below virtualizeThreshold, a plain CSS grid still needs its own end-of-list sentinel since react-window's onItemsRendered isn't in play here. */
function PlainGrid({
  children,
  className,
  gridClassName,
  onEndReached,
  rootMargin,
}: {
  children: ReactNode
  className?: string
  gridClassName: string
  onEndReached?: () => void
  rootMargin: string
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !onEndReached) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onEndReached()
      },
      { rootMargin },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onEndReached, rootMargin])

  return (
    <div className={className}>
      <div className={`grid gap-3 ${gridClassName}`}>{children}</div>
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
    </div>
  )
}
