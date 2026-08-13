import { useEffect, useState } from 'react'

/**
 * Mirrors a `grid-cols-{base} sm:grid-cols-{sm} lg:grid-cols-{lg}` Tailwind
 * pattern in JS, using the same breakpoints Tailwind ships by default
 * (sm: 640px, lg: 1024px) — so a virtualized grid lays out identically to
 * the plain CSS grid it replaces.
 */
export function useResponsiveColumns(base: number, sm: number, lg: number): number {
  const getColumns = () => {
    if (typeof window === 'undefined') return base
    if (window.innerWidth >= 1024) return lg
    if (window.innerWidth >= 640) return sm
    return base
  }

  const [columns, setColumns] = useState(getColumns)

  useEffect(() => {
    const smQuery = window.matchMedia('(min-width: 640px)')
    const lgQuery = window.matchMedia('(min-width: 1024px)')
    const update = () => setColumns(getColumns())
    update()
    smQuery.addEventListener('change', update)
    lgQuery.addEventListener('change', update)
    return () => {
      smQuery.removeEventListener('change', update)
      lgQuery.removeEventListener('change', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, sm, lg])

  return columns
}
