import { ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface HeaderProps {
  logoSlot?: ReactNode
  vehicleSelectorSlot?: ReactNode
  searchSlot?: ReactNode
  cartSlot?: ReactNode
  notificationSlot?: ReactNode
  languageSlot?: ReactNode
}

/** App header: composed of slots so features can inject their own content without this shell knowing about them. */
export function Header({
  logoSlot,
  vehicleSelectorSlot,
  searchSlot,
  cartSlot,
  notificationSlot,
  languageSlot,
}: HeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 border-b bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="shrink-0 font-heading text-xl font-semibold text-ink" aria-label={t('app.name')}>
          {logoSlot ?? t('app.name')}
        </Link>

        <div className="hidden shrink-0 md:block">{vehicleSelectorSlot}</div>

        <div className="min-w-0 flex-1">
          {searchSlot ?? (
            <input
              type="search"
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.searchPlaceholder')}
              className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            />
          )}
        </div>

        {languageSlot ? <div className="hidden shrink-0 sm:block">{languageSlot}</div> : null}

        {notificationSlot ? <div className="shrink-0">{notificationSlot}</div> : null}

        <Link
          to="/account"
          aria-label={t('nav.account')}
          className="hidden min-h-tap min-w-tap shrink-0 items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted md:flex"
        >
          <User className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="shrink-0">
          {cartSlot ?? (
            <Link
              to="/cart"
              aria-label="Cart"
              className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <div className="md:hidden">{vehicleSelectorSlot}</div>
    </header>
  )
}
