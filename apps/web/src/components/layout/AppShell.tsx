import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { FitmentBar } from '@/components/layout/FitmentBar'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { VehicleQuickSwitchSheet } from '@/components/layout/VehicleQuickSwitchSheet'
import { VehicleSelector } from '@/features/catalog/components/VehicleSelector'
import { LanguageSwitcher } from '@/features/auth/components/LanguageSwitcher'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { ResumePaymentBanner } from '@/features/orders/components/ResumePaymentBanner'
import { SearchBox } from '@/features/search/components/SearchBox'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

/**
 * Base shop shell: header, persistent fitment bar, routed content, mobile
 * bottom nav, footer. Seller and admin route groups use their own shells.
 *
 * The bar shows 'unverified' until a garage vehicle is active, since fitment
 * (FITS/DOES_NOT_FIT) can only be computed on a page that knows which part
 * is being viewed — the global shell just surfaces which vehicle is active
 * and lets the buyer switch it via VehicleQuickSwitchSheet.
 */
export function AppShell() {
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false)
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        vehicleSelectorSlot={<VehicleSelector />}
        searchSlot={<SearchBox />}
        notificationSlot={<NotificationBell />}
        languageSlot={<LanguageSwitcher compact />}
      />
      <ResumePaymentBanner />
      <FitmentBar
        status="unverified"
        vehicleLabel={
          activeVehicle
            ? (activeVehicle.nickname ?? `${activeVehicle.makeName} ${activeVehicle.modelName}`)
            : undefined
        }
        onClick={() => setQuickSwitchOpen(true)}
      />
      <VehicleQuickSwitchSheet open={quickSwitchOpen} onClose={() => setQuickSwitchOpen(false)} />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
