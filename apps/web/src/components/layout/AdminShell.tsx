import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { cn } from '@/lib/utils'

interface NavGroup {
  titleKey: string
  items: { to: string; end?: boolean; labelKey: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  { titleKey: 'admin.nav.groups.overview', items: [{ to: '/admin', end: true, labelKey: 'admin.nav.dashboard' }] },
  {
    titleKey: 'admin.nav.groups.sellers',
    items: [
      { to: '/admin/sellers', labelKey: 'admin.nav.sellers' },
      { to: '/admin/seller-applications', labelKey: 'admin.nav.sellerApplications' },
      { to: '/admin/brand-authorizations', labelKey: 'admin.nav.brandAuthorizations' },
    ],
  },
  {
    titleKey: 'admin.nav.groups.catalogue',
    items: [
      { to: '/admin/catalogue', labelKey: 'admin.nav.catalogue' },
      { to: '/admin/part-requests', labelKey: 'admin.nav.partRequests' },
    ],
  },
  { titleKey: 'admin.nav.groups.fitment', items: [{ to: '/admin/fitment', labelKey: 'admin.nav.fitment' }] },
  {
    titleKey: 'admin.nav.groups.listings',
    items: [
      { to: '/admin/listings', labelKey: 'admin.nav.listings' },
      { to: '/admin/spurious-reports', labelKey: 'admin.nav.spuriousReports' },
    ],
  },
  {
    titleKey: 'admin.nav.groups.orders',
    items: [
      { to: '/admin/orders', labelKey: 'admin.nav.orders' },
      { to: '/admin/rfqs', labelKey: 'admin.nav.rfqs' },
    ],
  },
  {
    titleKey: 'admin.nav.groups.returnsDisputes',
    items: [
      { to: '/admin/returns', labelKey: 'admin.nav.returns' },
      { to: '/admin/disputes', labelKey: 'admin.nav.disputes' },
      { to: '/admin/warranty-claims', labelKey: 'admin.nav.warrantyClaims' },
      { to: '/admin/support', labelKey: 'admin.nav.support' },
    ],
  },
  {
    titleKey: 'admin.nav.groups.finance',
    items: [
      { to: '/admin/finance', labelKey: 'admin.nav.finance' },
      { to: '/admin/gst-reports', labelKey: 'admin.nav.gstReports' },
    ],
  },
  { titleKey: 'admin.nav.groups.marketing', items: [{ to: '/admin/marketing', labelKey: 'admin.nav.marketing' }] },
  { titleKey: 'admin.nav.groups.content', items: [{ to: '/admin/content', labelKey: 'admin.nav.content' }] },
  {
    titleKey: 'admin.nav.groups.users',
    items: [
      { to: '/admin/users', labelKey: 'admin.nav.users' },
      { to: '/admin/credit-approvals', labelKey: 'admin.nav.creditApprovals' },
    ],
  },
  { titleKey: 'admin.nav.groups.config', items: [{ to: '/admin/config', labelKey: 'admin.nav.config' }] },
  { titleKey: 'admin.nav.groups.analytics', items: [{ to: '/admin/analytics', labelKey: 'admin.nav.analytics' }] },
  {
    titleKey: 'admin.nav.groups.platform',
    items: [
      { to: '/admin/review-moderation', labelKey: 'admin.nav.reviewModeration' },
      { to: '/admin/notifications', labelKey: 'admin.nav.notifications' },
      { to: '/admin/audit-log', labelKey: 'admin.nav.auditLog' },
    ],
  },
]

export function AdminShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b bg-ink px-4 py-3">
        <span className="font-heading text-lg font-semibold text-surface">SnapSpare Admin</span>
        <NotificationBell className="text-surface hover:bg-surface/10" />
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label={t('admin.nav.groups.overview')}
          className="shrink-0 space-y-4 overflow-y-auto border-b border-steel/20 bg-surface px-3 py-4 md:w-56 md:border-b-0 md:border-r"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-steel">{t(group.titleKey)}</p>
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'block min-h-tap rounded-[6px] px-2 py-2 text-sm text-ink hover:bg-surface-muted',
                          isActive && 'bg-signal/10 font-medium text-signal',
                        )
                      }
                    >
                      {t(item.labelKey)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
