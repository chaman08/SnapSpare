import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/features/auth/api/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import { initForegroundPushToasts } from '@/lib/pushNotifications'

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    // No-op if the browser never granted permission or doesn't support FCM
    // — onMessage() only ever fires for a page that already has a live
    // token, so this is safe to always mount.
    void initForegroundPushToasts()
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: 'font-body',
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
