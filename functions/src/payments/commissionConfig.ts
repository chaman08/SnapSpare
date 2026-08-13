import { type CommissionConfig, commissionConfigSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

const DEFAULT_COMMISSION_CONFIG: Omit<CommissionConfig, 'id' | 'updatedAt'> = {
  categoryRates: {},
  promotions: [],
  settlementCycleDays: 7,
  creditOverdueGraceDays: 7,
}

/**
 * Reads `config/commission` (category commission plan, per-seller override
 * precedence, promotional windows, settlement cadence — design brief item
 * 4), falling back to `DEFAULT_COMMISSION_CONFIG` when no admin has
 * customized it yet. Same treatment as functions/src/tax/taxConfig.ts's
 * getTaxConfig — a missing doc is a normal, safe state.
 */
export async function getCommissionConfig(): Promise<CommissionConfig> {
  const snapshot = await getFirestore().collection('config').doc('commission').get()
  if (!snapshot.exists) {
    return { id: 'commission', ...DEFAULT_COMMISSION_CONFIG, updatedAt: 0 }
  }
  return commissionConfigSchema.parse({ id: snapshot.id, ...snapshot.data() })
}
