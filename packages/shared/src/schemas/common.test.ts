import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { callableRequestSchema } from './common'

describe('callableRequestSchema', () => {
  const schema = callableRequestSchema(
    z.object({
      required: z.string(),
      optionalNumber: z.number().optional(),
      optionalString: z.string().optional(),
    }),
  )

  it('accepts a request where an optional field was genuinely omitted (undefined)', () => {
    const result = schema.safeParse({ required: 'x', optionalNumber: undefined })
    expect(result.success).toBe(true)
  })

  it('accepts the httpsCallable wire shape — an omitted optional field arrives as null', () => {
    // This is exactly what firebase/functions' httpsCallable sends for a
    // field the caller left undefined — the bug this wrapper exists to fix.
    const result = schema.safeParse({ required: 'x', optionalNumber: null, optionalString: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.optionalNumber).toBeUndefined()
      expect(result.data.optionalString).toBeUndefined()
    }
  })

  it('still rejects a required field that arrives null', () => {
    const result = schema.safeParse({ required: null })
    expect(result.success).toBe(false)
  })

  it('still accepts an explicitly provided optional value', () => {
    const result = schema.safeParse({ required: 'x', optionalNumber: 42 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.optionalNumber).toBe(42)
  })
})
