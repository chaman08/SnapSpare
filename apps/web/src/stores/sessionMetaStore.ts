import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionMetaState {
  /** Number of distinct app loads (tab opens/refreshes) on this device. */
  sessionCount: number
  hasSeenLanguagePrompt: boolean
  hasDismissedInstallPrompt: boolean
  registerSessionStart: () => void
  markLanguagePromptSeen: () => void
  markInstallPromptDismissed: () => void
}

/**
 * Tracks first-run/second-run state for two Phase 21 UX gates that both key
 * off "how many times has this person opened the app": the first-run
 * language picker (LanguageOnboardingDialog, session 1 only) and the PWA
 * install prompt (InstallPromptBanner, from session 2 onward, never on
 * first load per the product spec). One store instead of two so both
 * features share a single source of truth for "session number".
 */
export const useSessionMetaStore = create<SessionMetaState>()(
  persist(
    (set) => ({
      sessionCount: 0,
      hasSeenLanguagePrompt: false,
      hasDismissedInstallPrompt: false,
      registerSessionStart: () =>
        set((state) => ({ sessionCount: state.sessionCount + 1 })),
      markLanguagePromptSeen: () => set({ hasSeenLanguagePrompt: true }),
      markInstallPromptDismissed: () => set({ hasDismissedInstallPrompt: true }),
    }),
    { name: 'snapspare-session-meta' },
  ),
)
