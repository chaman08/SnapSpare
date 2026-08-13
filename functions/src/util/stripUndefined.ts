/**
 * Firestore's Admin SDK rejects an explicit `undefined` value outright
 * (throws "Cannot use 'undefined' as a Firestore value") unless
 * `ignoreUndefinedProperties` is set globally — not set anywhere in this
 * codebase, which instead guards each optional field explicitly at each
 * write site (see setHolidayMode.ts). Any object built by spreading a
 * zod-parsed shape with optional fields (`z.string().optional()` etc.)
 * will carry those keys as explicit `undefined` when the input omitted
 * them — safe to pass through JS logic, but not directly into `.set()`.
 * Shallow only: never strips a legitimately nested `null` (e.g.
 * `pricingTierSchema.maxQty: null`, meaning "open-ended").
 */
export function stripUndefined<T extends object>(value: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) result[key] = value[key]
  }
  return result
}
