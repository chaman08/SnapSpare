import { expect, test } from '@playwright/test'
import { ensureAppConfig, seedBuyer, seedPartWithListing, seedSeller } from './utils/adminSeed'

/**
 * Buyer purchase journey (Phase 23) — product detail -> add to cart ->
 * checkout -> COD order placed. Starts directly at the product detail page
 * by seeded part id rather than going through the search bar: search
 * (features/search/api/searchClient.ts) is backed by Typesense Cloud, an
 * external service the local Firebase emulator suite doesn't provide, so
 * exercising it here would either need real Typesense credentials (not
 * appropriate for a local/CI emulator-only e2e run) or HTTP-level mocking of
 * its client — see e2e/README.md for the full reasoning and how to extend
 * this spec to cover search once one of those is set up.
 *
 * Requires the FULL Firebase emulator suite running (`firebase
 * emulators:start`, not just `--only firestore`) since this drives real
 * sign-in through `__snapspareTestSignIn` (apps/web/src/lib/firebase.ts) and
 * real `onCall` functions via the actual UI.
 */
test('buyer can view a listing, add it to cart, and place a COD order', async ({ page }) => {
  await ensureAppConfig()
  const seller = await seedSeller()
  const buyer = await seedBuyer()
  const part = await seedPartWithListing(seller.sellerId)

  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __snapspareTestSignIn?: unknown }).__snapspareTestSignIn))
  await page.evaluate(
    (token) => (window as unknown as { __snapspareTestSignIn: (t: string) => Promise<void> }).__snapspareTestSignIn(token),
    buyer.customToken,
  )
  // AuthProvider's onSnapshot needs a moment to pick up the Firestore profile after sign-in.
  await expect(page.getByRole('link', { name: /account/i })).toBeVisible({ timeout: 15_000 })

  await page.goto(`/parts/${part.categorySlug}/${part.subcategorySlug}/p/${part.partId}`)
  await expect(page.getByRole('heading', { name: 'E2E Test Brake Pad Set' })).toBeVisible()

  await page.getByRole('button', { name: 'Add to cart' }).click()

  await page.goto('/cart')
  await expect(page.getByText('E2E Test Brake Pad Set')).toBeVisible()

  await page.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)

  // Delivery address: the buyer's one saved address should already be selectable/selected.
  await expect(page.getByText('1 Test Street')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('radiogroup', { name: /payment method/i }).getByText('Cash on Delivery').click()
  await page.getByRole('button', { name: 'Place order' }).click()

  // A confirmed COD order lands on the order detail/confirmation view.
  await expect(page.getByText(/order (placed|confirmed)/i)).toBeVisible({ timeout: 15_000 })
})
