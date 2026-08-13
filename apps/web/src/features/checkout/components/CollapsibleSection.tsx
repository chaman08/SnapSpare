import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  step: number
  title: string
  summary?: ReactNode
  complete?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
  disabled?: boolean
}

/** One of checkout's three collapsible sections (Delivery / Billing & GST / Payment) — a numbered step that shows a checkmark and collapsed summary once complete. Hand-rolled disclosure rather than the Tabs pattern since these are sequential steps, not alternative views. */
export function CollapsibleSection({
  step,
  title,
  summary,
  complete,
  open,
  onToggle,
  children,
  disabled,
}: CollapsibleSectionProps) {
  const contentId = `checkout-section-${step}-content`

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            complete ? 'bg-verify text-surface' : 'bg-steel/10 text-steel',
          )}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-semibold text-ink">{title}</span>
          {!open && summary ? <span className="block truncate text-sm text-steel">{summary}</span> : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0 text-steel transition-transform', open ? 'rotate-180' : '')}
        />
      </button>
      {open ? (
        <div id={contentId} className="space-y-4 border-t border-steel/10 px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  )
}
