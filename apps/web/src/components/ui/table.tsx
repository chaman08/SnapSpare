import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Plain semantic `<table>` wrapper — no Radix dependency needed, a table's
 * accessibility comes from native table semantics (scope, caption) rather
 * than ARIA roving-tabindex/focus-trap machinery, so hand-rolling here
 * follows the same "simple enough to not need Radix" precedent as
 * ui/tabs.tsx and ui/radio-group.tsx. The wrapper adds horizontal scroll so
 * wide tables (bulk-upload preview, stock ledger) never force the page body
 * to scroll sideways on a 360px viewport.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[560px] border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-steel/20 text-left', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-steel/10', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-surface-muted', className)} {...props} />
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-steel', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle text-ink', className)} {...props} />
}
