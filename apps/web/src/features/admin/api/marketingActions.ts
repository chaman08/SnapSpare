import type {
  Banner,
  Campaign,
  Coupon,
  HomeSection,
  ReorderHomeSectionsRequest,
  ReorderHomeSectionsResult,
  SaveBannerRequest,
  SaveBannerResult,
  SaveCampaignRequest,
  SaveCampaignResult,
  SaveCouponRequest,
  SaveCouponResult,
  SaveHomeSectionRequest,
  SaveHomeSectionResult,
  SendCampaignRequest,
  SendCampaignResult,
} from '@snapspare/shared'
import { bannerConverter, campaignConverter, couponConverter, homeSectionConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'coupons').withConverter(clientConverter(couponConverter)), orderBy('createdAt', 'desc'), limit(100))
    return onSnapshot(q, (snapshot) => {
      setCoupons(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { coupons, loading }
}

export function useBanners() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'banners').withConverter(clientConverter(bannerConverter)), orderBy('sortOrder', 'asc'), limit(100))
    return onSnapshot(q, (snapshot) => {
      setBanners(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { banners, loading }
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'campaigns').withConverter(clientConverter(campaignConverter)), orderBy('createdAt', 'desc'), limit(100))
    return onSnapshot(q, (snapshot) => {
      setCampaigns(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { campaigns, loading }
}

const saveCouponCallable = httpsCallable<SaveCouponRequest, SaveCouponResult>(functions, 'saveCoupon')
export async function saveCoupon(request: SaveCouponRequest): Promise<SaveCouponResult> {
  return (await saveCouponCallable(request)).data
}

const saveBannerCallable = httpsCallable<SaveBannerRequest, SaveBannerResult>(functions, 'saveBanner')
export async function saveBanner(request: SaveBannerRequest): Promise<SaveBannerResult> {
  return (await saveBannerCallable(request)).data
}

const saveCampaignCallable = httpsCallable<SaveCampaignRequest, SaveCampaignResult>(functions, 'saveCampaign')
export async function saveCampaign(request: SaveCampaignRequest): Promise<SaveCampaignResult> {
  return (await saveCampaignCallable(request)).data
}

const sendCampaignCallable = httpsCallable<SendCampaignRequest, SendCampaignResult>(functions, 'sendCampaign')
export async function sendCampaign(request: SendCampaignRequest): Promise<SendCampaignResult> {
  return (await sendCampaignCallable(request)).data
}

export function useHomeSections() {
  const [sections, setSections] = useState<HomeSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'homeSections').withConverter(clientConverter(homeSectionConverter)), orderBy('sortOrder', 'asc'), limit(100))
    return onSnapshot(q, (snapshot) => {
      setSections(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { sections, loading }
}

const saveHomeSectionCallable = httpsCallable<SaveHomeSectionRequest, SaveHomeSectionResult>(functions, 'saveHomeSection')
export async function saveHomeSection(request: SaveHomeSectionRequest): Promise<SaveHomeSectionResult> {
  return (await saveHomeSectionCallable(request)).data
}

const reorderHomeSectionsCallable = httpsCallable<ReorderHomeSectionsRequest, ReorderHomeSectionsResult>(functions, 'reorderHomeSections')
export async function reorderHomeSections(request: ReorderHomeSectionsRequest): Promise<ReorderHomeSectionsResult> {
  return (await reorderHomeSectionsCallable(request)).data
}
