import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { cn } from '@/lib/utils'

export function SellerShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-ink px-4 py-3 print:hidden">
        <div className="flex items-center gap-6">
          <span className="font-heading text-lg font-semibold text-surface">SnapSpare Seller</span>
          <nav className="flex flex-1 gap-4">
            <NavLink
              to="/seller"
              end
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.dashboard')}
            </NavLink>
            <NavLink
              to="/seller/listings"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.listings')}
            </NavLink>
            <NavLink
              to="/seller/part-requests"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.partRequests')}
            </NavLink>
            <NavLink
              to="/seller/rfqs"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.rfqs')}
            </NavLink>
            <NavLink
              to="/seller/orders"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.orders')}
            </NavLink>
            <NavLink
              to="/seller/warranty-claims"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.warrantyClaims')}
            </NavLink>
            <NavLink
              to="/seller/disputes"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.disputes')}
            </NavLink>
            <NavLink
              to="/seller/tax"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.tax')}
            </NavLink>
            <NavLink
              to="/seller/payments"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.payments')}
            </NavLink>
            <NavLink
              to="/seller/staff"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.staff')}
            </NavLink>
            <NavLink
              to="/seller/settings"
              className={({ isActive }) =>
                cn('min-h-tap text-sm text-surface/70 hover:text-surface', isActive && 'font-medium text-surface')
              }
            >
              {t('sellerOrders.nav.settings')}
            </NavLink>
          </nav>
          <NotificationBell className="text-surface hover:bg-surface/10" />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
