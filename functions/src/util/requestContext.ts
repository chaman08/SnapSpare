import type { CallableRequest } from 'firebase-functions/v2/https'

/**
 * Best-effort client IP. Cloud Functions v2 runs on Cloud Run behind
 * Google's front-end proxy, so `rawRequest.ip` is the proxy hop, not the
 * caller — `x-forwarded-for`'s first entry is the original client and is
 * preferred when present. Shared by auditLog.ts (attribution) and
 * rateLimit.ts (per-IP throttling) so both derive the caller's IP the same
 * way.
 */
export function extractIp(request: CallableRequest): string | undefined {
  const forwarded = request.rawRequest?.headers?.['x-forwarded-for']
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (typeof forwardedValue === 'string' && forwardedValue.length > 0) {
    return forwardedValue.split(',')[0]?.trim()
  }
  return request.rawRequest?.ip
}
