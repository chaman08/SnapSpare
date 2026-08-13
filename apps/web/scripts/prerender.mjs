// Post-build static prerendering (Phase 22's SEO decision — see the README's
// "SEO: prerendering vs SSR" note for why this approach was chosen over a
// full Vite SSR migration). Boots a local static server over `dist/`,
// visits every URL from generate-prerender-urls.mjs with a real headless
// browser, waits for the SPA to finish its data fetches, and writes the
// fully-rendered HTML to `dist/<path>/index.html`. Firebase Hosting matches
// a request against a literal static file *before* falling through to the
// SPA catch-all rewrite (firebase.json's `"source": "**"` rule) — so these
// snapshot files are what a crawler (or a user with JS disabled) actually
// receives at those exact paths, with zero bot-detection logic needed,
// while every other route still gets the live single-page app.
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const URLS_PATH = fileURLToPath(new URL('./prerender-urls.json', import.meta.url))
const PORT = 4321

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

async function fileExists(path) {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

/** Minimal static file server with SPA fallback — good enough for a local, single-purpose prerender pass; not meant to be a general-purpose dev server. */
function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      const candidate = join(DIST_DIR, urlPath)
      const filePath = (await fileExists(candidate)) ? candidate : join(DIST_DIR, 'index.html')
      const body = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' })
      res.end(body)
    } catch (error) {
      res.writeHead(500)
      res.end(String(error))
    }
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

async function main() {
  let urls
  try {
    urls = JSON.parse(await readFile(URLS_PATH, 'utf-8'))
  } catch {
    console.warn('[prerender] No prerender-urls.json found — run generate-prerender-urls.mjs first. Skipping.')
    return
  }
  if (urls.length === 0) {
    console.warn('[prerender] URL list is empty — skipping.')
    return
  }

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.warn(
      '[prerender] `playwright` is not installed (or its browser binaries are missing — run `npx playwright install chromium`). Skipping prerendering; the SPA shell still works for every route, it just won\'t have pre-rendered HTML for crawlers this build.',
    )
    return
  }

  const server = await startStaticServer()
  const browser = await chromium.launch()
  const page = await browser.newPage()

  let succeeded = 0
  for (const path of urls) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle', timeout: 30_000 })
      // The app's data-driven pages resolve their content via TanStack Query
      // after mount — `networkidle` covers the common case, this extra beat
      // covers a page whose last fetch kicks off a *second* dependent fetch
      // (e.g. resolve vehicle slug, then query listings).
      await page.waitForTimeout(300)
      const html = await page.content()

      const outDir = path === '/' ? DIST_DIR : join(DIST_DIR, path)
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, 'index.html'), html)
      succeeded += 1
    } catch (error) {
      console.warn(`[prerender] Failed to render ${path}:`, error.message)
    }
  }

  await browser.close()
  server.close()
  console.log(`[prerender] Rendered ${succeeded}/${urls.length} pages.`)
}

await main()
