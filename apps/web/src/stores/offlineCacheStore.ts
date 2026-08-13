import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OfflineOrderSummary {
  id: string
  status: string
  totalPaise: number
  placedAt: number
}

export interface OfflineGarageVehicle {
  id: string
  label: string
}

interface OfflineCacheState {
  recentOrders: OfflineOrderSummary[]
  garageVehicles: OfflineGarageVehicle[]
  setRecentOrders: (orders: OfflineOrderSummary[]) => void
  setGarageVehicles: (vehicles: OfflineGarageVehicle[]) => void
}

/**
 * Mirrors just enough of "recent orders" and "my garage" into localStorage,
 * under the same key public/offline.html reads directly (see that file's
 * inline script) — the offline fallback page is a static file with no
 * bundler/React, served by the service worker when navigation fails, so it
 * can't call Firestore or import this store; it can only read raw
 * localStorage. OrdersPage and GarageList call the setters here whenever
 * they successfully load live data, so the cache is at most one online
 * session stale.
 */
export const useOfflineCacheStore = create<OfflineCacheState>()(
  persist(
    (set) => ({
      recentOrders: [],
      garageVehicles: [],
      setRecentOrders: (orders) => set({ recentOrders: orders.slice(0, 5) }),
      setGarageVehicles: (vehicles) => set({ garageVehicles: vehicles.slice(0, 10) }),
    }),
    { name: 'snapspare-offline-cache' },
  ),
)
