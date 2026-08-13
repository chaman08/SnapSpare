import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useRef,
} from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupContextValue {
  value: string
  onValueChange: (value: string) => void
  name: string
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined)

function useRadioGroupContext(component: string): RadioGroupContextValue {
  const ctx = useContext(RadioGroupContext)
  if (!ctx) throw new Error(`${component} must be used within <RadioGroup>`)
  return ctx
}

interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  name: string
  children: ReactNode
  className?: string
  'aria-label'?: string
}

/** Hand-rolled (no @radix-ui/react-radio-group dependency in this repo, matching Tabs.tsx's precedent) but the same ARIA pattern: a single `radiogroup`, roving tabindex, arrow-key navigation between options. */
export function RadioGroup({ value, onValueChange, name, children, className, 'aria-label': ariaLabel }: RadioGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    const options = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [],
    )
    if (options.length === 0) return
    const currentIndex = options.findIndex((el) => el === document.activeElement)
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const nextIndex = forward
      ? (currentIndex + 1 + options.length) % options.length
      : (currentIndex - 1 + options.length) % options.length

    event.preventDefault()
    options[nextIndex]?.focus()
    options[nextIndex]?.click()
  }

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex lives on the individual RadioGroupItem buttons (tabIndex={isChecked ? 0 : -1}), not this container, per the ARIA radiogroup authoring pattern (same precedent as Tabs.tsx's TabsList). */}
      <div ref={groupRef} role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className={className}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function RadioGroupItem({ value, children, className, disabled }: RadioGroupItemProps) {
  const ctx = useRadioGroupContext('RadioGroupItem')
  const isChecked = ctx.value === value

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isChecked}
      disabled={disabled}
      tabIndex={isChecked ? 0 : -1}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'flex min-h-tap w-full items-start gap-3 rounded-[6px] border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-50',
        isChecked ? 'border-signal bg-signal/5' : 'border-steel/30 hover:bg-surface-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          isChecked ? 'border-signal' : 'border-steel/40',
        )}
      >
        {isChecked ? <span className="h-2 w-2 rounded-full bg-signal" /> : null}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  )
}
