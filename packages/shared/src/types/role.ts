import { z } from 'zod'

export const roleSchema = z.enum(['buyer', 'seller', 'admin'])

export type Role = z.infer<typeof roleSchema>
