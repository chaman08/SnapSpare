import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useId,
  useRef,
} from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  idPrefix: string
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`${component} must be used within <Tabs>`)
  return ctx
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

/** Controlled tabs root — hand-rolled (no @radix-ui/react-tabs dependency in this repo) but matching the same ARIA pattern: roving tabindex, arrow-key navigation, `tab`/`tabpanel` linked by id. */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const idPrefix = useId()
  return (
    <TabsContext.Provider value={{ value, onValueChange, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
  'aria-label': string
}

export function TabsList({ children, className, 'aria-label': ariaLabel }: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const triggers = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
    )
    if (triggers.length === 0) return
    const currentIndex = triggers.findIndex((el) => el === document.activeElement)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % triggers.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + triggers.length) % triggers.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = triggers.length - 1

    event.preventDefault()
    triggers[nextIndex]?.focus()
    triggers[nextIndex]?.click()
  }

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex lives on the individual TabsTrigger buttons (see tabIndex={isActive ? 0 : -1} below), not this container, per the ARIA tabs authoring pattern.
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('flex gap-1 overflow-x-auto border-b border-steel/20', className)}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = useTabsContext('TabsTrigger')
  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.idPrefix}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${ctx.idPrefix}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'min-h-tap shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
        isActive ? 'border-signal text-ink' : 'border-transparent text-steel hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useTabsContext('TabsContent')
  if (ctx.value !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${ctx.idPrefix}-panel-${value}`}
      aria-labelledby={`${ctx.idPrefix}-tab-${value}`}
      tabIndex={0}
      className={cn('py-4', className)}
    >
      {children}
    </div>
  )
}
