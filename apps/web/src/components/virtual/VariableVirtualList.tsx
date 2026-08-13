import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { VariableSizeList } from 'react-window'

interface VariableVirtualListProps<T> {
  items: T[]
  getItemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  estimatedItemHeight: number
  height: number
  gap?: number
  /** Below this item count, render a plain stacked list instead — matches VirtualizedGrid's rationale for search results. */
  virtualizeThreshold?: number
  className?: string
}

/**
 * Windowed replacement for a `<ul>{items.map(...)}</ul>` list whose rows
 * have genuinely variable height (seller order rows grow when a return/QC
 * panel or the ship form expands inline) — used by SellerOrdersPage. Each
 * row measures its own rendered height via ResizeObserver and reports it
 * back so react-window can reflow everything below it, the standard
 * "dynamic row height" recipe for VariableSizeList.
 */
export function VariableVirtualList<T>({
  items,
  getItemKey,
  renderItem,
  estimatedItemHeight,
  height,
  gap = 12,
  virtualizeThreshold = 20,
  className,
}: VariableVirtualListProps<T>) {
  const listRef = useRef<VariableSizeList>(null)
  const sizeMap = useRef<Record<number, number>>({})

  function setSize(index: number, size: number) {
    const prev = sizeMap.current[index]
    sizeMap.current[index] = size
    if (prev !== size) listRef.current?.resetAfterIndex(index)
  }

  useEffect(() => {
    sizeMap.current = {}
    listRef.current?.resetAfterIndex(0)
  }, [items.length])

  if (items.length <= virtualizeThreshold) {
    return (
      <ul className={className} style={{ display: 'flex', flexDirection: 'column', gap }}>
        {items.map((item, index) => (
          <li key={getItemKey(item, index)}>{renderItem(item, index)}</li>
        ))}
      </ul>
    )
  }

  return (
    <VariableSizeList
      ref={listRef}
      className={className}
      height={height}
      width="100%"
      itemCount={items.length}
      estimatedItemSize={estimatedItemHeight}
      itemSize={(index) => (sizeMap.current[index] ?? estimatedItemHeight) + gap}
    >
      {({ index, style }) => (
        <div style={style}>
          <MeasuredRow index={index} onMeasured={setSize}>
            {/* react-window only ever calls this with 0 <= index < itemCount */}
            {renderItem(items[index]!, index)}
          </MeasuredRow>
        </div>
      )}
    </VariableSizeList>
  )
}

function MeasuredRow({
  index,
  onMeasured,
  children,
}: {
  index: number
  onMeasured: (index: number, size: number) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) onMeasured(index, entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  return <div ref={ref}>{children}</div>
}
