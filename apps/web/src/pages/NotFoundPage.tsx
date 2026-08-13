import { EmptyState } from '@/components/states/EmptyState'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <EmptyState title="Page not found" />
    </div>
  )
}
