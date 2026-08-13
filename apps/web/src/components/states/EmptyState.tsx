import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

/** Standard empty state for list screens: never a blank screen, always a next action. */
export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon}
      <p className="font-heading text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-xs text-sm text-steel">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
