import type { PricingTemplate } from '@snapspare/shared'
import { pricingTemplateConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useSellerPricingTemplates(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-pricing-templates', sellerId],
    queryFn: async (): Promise<PricingTemplate[]> => {
      if (!sellerId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'pricingTemplates').withConverter(clientConverter(pricingTemplateConverter)),
          where('sellerId', '==', sellerId),
          orderBy('createdAt', 'desc'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(sellerId),
    staleTime: 30_000,
  })
}
