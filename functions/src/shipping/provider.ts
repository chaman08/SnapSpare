import { MockShippingProvider } from './mockShippingProvider.js'
import type { ShippingProvider } from './shippingProvider.js'

/**
 * Single swap point, same pattern as vehicle/lookupVehicleByReg.ts's
 * `provider` constant. Swap for the real Shiprocket integration before
 * production launch:
 *
 *   import { ShiprocketProvider } from './shiprocketProvider.js'
 *   export const provider: ShippingProvider = new ShiprocketProvider(
 *     SHIPROCKET_EMAIL.value(),
 *     SHIPROCKET_PASSWORD.value(),
 *   )
 *
 * That reads `.value()` at module load, which only works once every
 * callable importing this module also declares
 * `secrets: [SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD]` in its `onCall`/
 * `onRequest`/`onSchedule` options (secret values are only resolvable
 * inside a bound function's request handler, not at cold-start module
 * load) — see functions/src/shipping/secrets.ts.
 */
export const provider: ShippingProvider = new MockShippingProvider()
