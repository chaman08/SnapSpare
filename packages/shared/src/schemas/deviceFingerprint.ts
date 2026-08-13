import { z } from 'zod'
import { callableRequestSchema } from './common'

/** A SHA-256 hex digest (64 lowercase hex chars) of a handful of stable, low-entropy browser signals — see apps/web/src/lib/deviceFingerprint.ts for what goes into it. Not a forensic-grade fingerprint (no canvas/WebGL/audio entropy), just enough to flag the same device registering an unusual number of accounts for admin review. */
export const registerDeviceFingerprintRequestSchema = callableRequestSchema(
  z.object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/, 'fingerprint must be a 64-char hex SHA-256 digest'),
  }),
)
export type RegisterDeviceFingerprintRequest = z.infer<typeof registerDeviceFingerprintRequestSchema>
