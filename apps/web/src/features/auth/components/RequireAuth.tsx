import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useRequireAuth()

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return <>{children}</>
}
