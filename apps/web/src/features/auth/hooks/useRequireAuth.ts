import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/api/AuthProvider'

/** Redirects to /login?redirect=<current path> once auth state resolves to "signed out". */
export function useRequireAuth() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading || user) return
    const redirect = encodeURIComponent(location.pathname + location.search)
    navigate(`/login?redirect=${redirect}`, { replace: true })
  }, [loading, user, navigate, location.pathname, location.search])

  return { user, loading }
}
