import type { Role } from '@snapspare/shared'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'

/**
 * Redirects to /login if signed out, or to / if signed in but missing the
 * required role claim. Does not check seller "active" status — that's a
 * live Firestore read, handled separately by RequireRole for the seller case.
 */
export function useRequireRole(requiredRole: Role) {
  const { user, claims, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${redirect}`, { replace: true })
      return
    }
    if (claims?.role !== requiredRole) {
      navigate('/', { replace: true })
    }
  }, [loading, user, claims, requiredRole, navigate, location.pathname, location.search])

  return { user, claims, loading, allowed: claims?.role === requiredRole }
}
