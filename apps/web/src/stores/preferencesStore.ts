import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferencesState {
  /** Smaller images, no autoplay, reduced prefetch — for buyers on a limited data plan or a slow connection. */
  lowDataMode: boolean
  /** True once the buyer has explicitly touched the toggle — after that, initLowDataModeAutoDetect() never overrides their choice. */
  lowDataModeSetByUser: boolean
  setLowDataMode: (value: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      lowDataMode: false,
      lowDataModeSetByUser: false,
      setLowDataMode: (value) => set({ lowDataMode: value, lowDataModeSetByUser: true }),
    }),
    { name: 'snapspare-preferences' },
  ),
)

interface NetworkInformation extends EventTarget {
  saveData?: boolean
}

/**
 * Defaults low-data mode on for buyers whose OS/browser already reports
 * "Data Saver" is on (Android Chrome's `navigator.connection.saveData`),
 * without ever overriding a choice the buyer already made themselves.
 * Not all browsers implement the Network Information API — this is a
 * best-effort default, not a requirement.
 */
export function initLowDataModeAutoDetect() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection?.saveData) return
  const { lowDataModeSetByUser, setLowDataMode } = usePreferencesStore.getState()
  if (!lowDataModeSetByUser) setLowDataMode(true)
}
