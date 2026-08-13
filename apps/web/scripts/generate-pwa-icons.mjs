// One-off generator for the PWA manifest icons (public/icons/*.png) and the
// iOS apple-touch-icon. Not wired into dev/build — run manually
// (`node scripts/generate-pwa-icons.mjs`) whenever the mark changes. Written
// as flat-color pixel-pushed PNGs (no anti-aliasing) using only Node's
// built-in zlib, deliberately avoiding a new dependency (sharp/canvas) for
// what is otherwise a two-color triangle-on-square logo — see
// public/favicon.svg, which this mirrors at raster sizes manifest icons
// require. Re-run and swap in a designed asset via a real image pipeline
// before shipping a production build if higher fidelity is needed.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${webRoot}/public/icons`
mkdirSync(outDir, { recursive: true })

const INK = [0x14, 0x18, 0x1c]
const SIGNAL = [0xff, 0x6b, 0x00]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

/** isInsideTriangle: point-in-triangle via sign of cross products, used to rasterize the same mark as public/favicon.svg (an upward triangle) at any resolution. */
function isInsideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/**
 * @param size final PNG width/height in px
 * @param cornerRadiusFrac rounded-rect corner radius as a fraction of size (0 = full-bleed square, for maskable icons)
 * @param triangleScale triangle size as a fraction of the canvas (favicon uses ~0.47; maskable safe-zone needs it smaller)
 */
function renderIcon(size, { cornerRadiusFrac = 0, triangleScale = 0.47 } = {}) {
  const raw = Buffer.alloc(size * (1 + size * 3))
  const r = size * cornerRadiusFrac
  const half = (size * triangleScale) / 2
  const cx = size / 2
  const top = cx - half
  const bottom = cx + half
  const ax = cx, ay = top
  const bx = cx - half, by = bottom
  const ccx = cx + half, ccy = bottom

  for (let y = 0; y < size; y++) {
    let rowStart = y * (1 + size * 3)
    raw[rowStart] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      let color = INK
      // Rounded-rect mask: outside the corner radius arcs counts as transparent-ish background fallback (we just paint surface white there so a non-masking OS still sees a clean rounded square).
      const inCorner =
        (x < r && y < r && Math.hypot(r - x, r - y) > r) ||
        (x >= size - r && y < r && Math.hypot(x - (size - r), r - y) > r) ||
        (x < r && y >= size - r && Math.hypot(r - x, y - (size - r)) > r) ||
        (x >= size - r && y >= size - r && Math.hypot(x - (size - r), y - (size - r)) > r)
      if (inCorner) color = [255, 255, 255]
      else if (isInsideTriangle(x, y, ax, ay, bx, by, ccx, ccy)) color = SIGNAL

      const offset = rowStart + 1 + x * 3
      raw[offset] = color[0]
      raw[offset + 1] = color[1]
      raw[offset + 2] = color[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor (RGB)
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync(`${outDir}/icon-192.png`, renderIcon(192, { cornerRadiusFrac: 0.1875 }))
writeFileSync(`${outDir}/icon-512.png`, renderIcon(512, { cornerRadiusFrac: 0.1875 }))
// Maskable: full-bleed background (OS applies its own mask shape), mark
// shrunk to fit the ~80%-diameter safe zone every platform guarantees.
writeFileSync(`${outDir}/icon-maskable-512.png`, renderIcon(512, { cornerRadiusFrac: 0, triangleScale: 0.34 }))
writeFileSync(`${outDir}/apple-touch-icon.png`, renderIcon(180, { cornerRadiusFrac: 0 }))

console.log('Wrote icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png to public/icons/')
