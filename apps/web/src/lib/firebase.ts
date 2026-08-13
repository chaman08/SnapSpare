import { type FirebaseApp, initializeApp } from 'firebase/app'
import {
  type AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'
// Auth can opt out of the emulator suite independently, so Google sign-in goes through
// real Google OAuth (the emulator's popup is a fake form, not the real account picker)
// while Firestore/Functions/Storage stay emulated.
const useAuthEmulator = useEmulators && import.meta.env.VITE_USE_AUTH_EMULATOR !== 'false'
const region = 'asia-south1'

export const app: FirebaseApp = initializeApp(firebaseConfig)

// App Check must be initialised before any other Firebase service is used
// against a prod-mode project, so it's set up right after the app itself.
export let appCheck: AppCheck | undefined

if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    // https://firebase.google.com/docs/app-check/web/debug-provider
    ;(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
} else if (import.meta.env.DEV && useEmulators) {
  // No reCAPTCHA Enterprise key registered locally: every callable sets
  // enforceAppCheck: true, so without this the Functions emulator 401s on
  // every call. Fall back to App Check's debug provider, which the emulator
  // suite accepts without a real site key. https://firebase.google.com/docs/app-check/web/debug-provider
  // VITE_APPCHECK_DEBUG_TOKEN unset -> the SDK generates a token and logs it
  // to the console; set the env var to reuse a fixed token across runs.
  ;(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('debug-provider-placeholder-key'),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, region)

if (useAuthEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)

  // Test-only sign-in hook for Playwright (apps/web/e2e/) — real users always
  // sign in via phone OTP/Google (AuthProvider.tsx), never a custom token, so
  // this only exists to let an e2e spec authenticate as an Admin-SDK-seeded
  // fixture user without driving the OTP UI. `import.meta.env.DEV` is
  // statically false in a production build, so Vite dead-code-eliminates
  // this entire block (and the `useEmulators` branch it's nested in already
  // requires VITE_USE_EMULATORS=true) — it never reaches a prod bundle.
  if (import.meta.env.DEV) {
    ;(window as typeof window & { __snapspareTestSignIn?: (token: string) => Promise<void> }).__snapspareTestSignIn = async (
      token: string,
    ) => {
      await signInWithCustomToken(auth, token)
    }
  }
}
