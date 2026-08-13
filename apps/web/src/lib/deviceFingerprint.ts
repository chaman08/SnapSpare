/**
 * Lightweight, dependency-free device signal for duplicate-account
 * detection (Phase 23) — not a forensic-grade fingerprint (no canvas/WebGL/
 * audio entropy the way a commercial fraud SDK would use), just a stable
 * hash of a handful of low-entropy browser properties that's cheap to
 * compute and good enough to flag a device registering an unusual number of
 * accounts for admin review. See functions/src/abuse/registerDeviceFingerprint.ts
 * for how it's used server-side.
 */
export async function computeDeviceFingerprint(): Promise<string> {
  const signals = [
    navigator.userAgent,
    navigator.language,
    String(navigator.hardwareConcurrency ?? ''),
    String(screen.colorDepth),
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signals))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
