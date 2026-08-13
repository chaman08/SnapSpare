import { Car, Home, LayoutGrid, Receipt, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  { to: '/categories', labelKey: 'nav.categories', icon: LayoutGrid },
  { to: '/garage', labelKey: 'nav.garage', icon: Car },
  { to: '/orders', labelKey: 'nav.orders', icon: Receipt },
  { to: '/account', labelKey: 'nav.account', icon: User },
] as const

/** Mobile-only bottom navigation. Hidden at md+ where the header carries primary nav. */
export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-surface md:hidden"
    >
      {ITEMS.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium',
              isActive ? 'text-signal' : 'text-steel',
            )
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
