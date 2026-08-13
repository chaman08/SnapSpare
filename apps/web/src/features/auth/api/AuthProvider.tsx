import { type CustomClaims, customClaimsSchema, type User as UserProfile, userConverter } from '@snapspare/shared'
import {
  type ConfirmationResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { mergeGuestCartIntoFirestore } from '@/features/cart/api/mergeGuestCart'
import { acceptSellerStaffInvite } from '@/features/seller/api/sellerStaffActions'
import { auth, db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import { registerDeviceFingerprint } from './registerDeviceFingerprint'
import { sendOtp } from './phoneAuth'

interface AuthContextValue {
  user: FirebaseUser | null
  profile: UserProfile | null
  claims: CustomClaims | null
  loading: boolean
  signInWithPhone: (localPhoneNumber: string) => Promise<void>
  verifyOtp: (code: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshClaims: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [claims, setClaims] = useState<CustomClaims | null>(null)
  const [loading, setLoading] = useState(true)
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)
  const previousUidRef = useRef<string | null>(null)

  useEffect(
    () =>
      onIdTokenChanged(auth, async (nextUser) => {
        setUser(nextUser)

        if (!nextUser) {
          setClaims(null)
          setLoading(false)
          previousUidRef.current = null
          return
        }

        const tokenResult = await nextUser.getIdTokenResult()
        const parsedClaims = customClaimsSchema.safeParse(tokenResult.claims)
        setClaims(parsedClaims.success ? parsedClaims.data : null)

        // Merge any guest cart into the buyer's Firestore cart exactly once per sign-in.
        if (previousUidRef.current !== nextUser.uid) {
          previousUidRef.current = nextUser.uid
          void mergeGuestCartIntoFirestore(nextUser.uid)
          // Best-effort claim of a pending seller-staff invite addressed to this
          // phone number (see acceptSellerStaffInvite.ts) — a no-op "not-found"
          // for the overwhelming majority of sign-ins that were never invited.
          void acceptSellerStaffInvite()
            .then(() => nextUser.getIdToken(true))
            .catch(() => undefined)
          // Best-effort duplicate-account signal (Phase 23) — never blocks
          // sign-in, silently skipped on browsers without SubtleCrypto.
          void registerDeviceFingerprint().catch(() => undefined)
        }

        setLoading(false)
      }),
    [],
  )

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    return onSnapshot(
      doc(db, 'users', user.uid).withConverter(clientConverter(userConverter)),
      (snapshot) => setProfile(snapshot.exists() ? snapshot.data() : null),
      () => setProfile(null),
    )
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      claims,
      loading,
      async signInWithPhone(localPhoneNumber) {
        confirmationResultRef.current = await sendOtp(localPhoneNumber)
      },
      async verifyOtp(code) {
        if (!confirmationResultRef.current) {
          throw new Error('signInWithPhone must be called before verifyOtp')
        }
        await confirmationResultRef.current.confirm(code)
        confirmationResultRef.current = null
      },
      async signInWithGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider())
      },
      async signOut() {
        await firebaseSignOut(auth)
      },
      async refreshClaims() {
        if (!auth.currentUser) return
        const tokenResult = await auth.currentUser.getIdTokenResult(true)
        const parsedClaims = customClaimsSchema.safeParse(tokenResult.claims)
        setClaims(parsedClaims.success ? parsedClaims.data : null)
      },
    }),
    [user, profile, claims, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
