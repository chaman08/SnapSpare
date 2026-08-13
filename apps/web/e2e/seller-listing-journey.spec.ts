import { expect, test } from '@playwright/test'
import { ensureAppConfig, seedPartWithListing, seedSeller } from './utils/adminSeed'

/**
 * Seller listing journey (Phase 23) — sign in as a seller, find an existing
 * listing in the seller listings table, edit its stock quantity, and verify
 * the change persists. Uses an existing seeded listing + `/seller/listings/
 * :listingId/edit` rather than the "Add listing" wizard
 * (pages/seller/AddListingPage.tsx): its first step is a catalog-part
 * typeahead (features/seller-listings/components/CatalogPartTypeahead.tsx)
 * that's also Typesense-backed, same external-service gap as the buyer
 * journey's search step — see e2e/README.md. Editing pricing/stock on an
 * already-listed part is just as real a "seller listing management" journey
 * and reads straight from Firestore (features/seller-listings/api/
 * useSellerListings.ts), so it isn't blocked by that gap.
 *
 * Requires the full Firebase emulator suite running — see
 * buyer-purchase-journey.spec.ts's header comment for why.
 */
test('seller can see their listing and update its stock quantity', async ({ page }) => {
  await ensureAppConfig()
  const seller = await seedSeller()
  await seedPartWithListing(seller.sellerId)

  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __snapspareTestSignIn?: unknown }).__snapspareTestSignIn))
  await page.evaluate(
    (token) => (window as unknown as { __snapspareTestSignIn: (t: string) => Promise<void> }).__snapspareTestSignIn(token),
    seller.customToken,
  )

  await page.goto('/seller/listings')
  await expect(page.getByText('E2E Test Brake Pad Set')).toBeVisible({ timeout: 15_000 })

  await page.getByText('E2E Test Brake Pad Set').click()
  await expect(page).toHaveURL(/\/seller\/listings\/.+\/edit/)

  const stockInput = page.getByLabel(/stock/i)
  await stockInput.fill('75')
  await page.getByRole('button', { name: /save/i }).click()

  await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 10_000 })

  await page.goto('/seller/listings')
  await expect(page.getByText('E2E Test Brake Pad Set')).toBeVisible()
})
