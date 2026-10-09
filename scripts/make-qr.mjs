#!/usr/bin/env node
// Branded registration QR: error correction H, solid (touching) modules, a centre logo plate covering
// about 12% of the code, burgundy modules and magenta eyes on white (the flyer's colours). Then it proves the result decodes (jsQR) at print and
// thumbnail sizes, plus a blurred, rotated "phone photo" copy. Exits non-zero if any decode fails.
//
// Its libraries are kept out of the app's dependencies: install them in a scratch folder and point at it.
//   mkdir -p /tmp/qr-tool && (cd /tmp/qr-tool && npm init -y && npm i qrcode@1.5.4 jsqr@1.4.0 sharp@0.34.3)
//   QR_TOOL_DIR=/tmp/qr-tool node scripts/make-qr.mjs https://wives-hangout.vercel.app/?src=qr "brand/wives hangout - text.png" docs/launch/wives-hangout-qr.png
// Colours mirror src/styles/theme.css. The centre image should be white (the title lettering or the white logo):
// it sits on a burgundy plate shaped to its proportions.

import { createRequire } from 'node:module'
import { join } from 'node:path'

const [url, logoPath, outPath] = process.argv.slice(2)
if (!url || !logoPath || !outPath || !process.env.QR_TOOL_DIR) {
  console.error('Usage: QR_TOOL_DIR=<dir> node scripts/make-qr.mjs <url> <logo.png> <out.png>')
  process.exit(1)
}
const require = createRequire(join(process.env.QR_TOOL_DIR, 'package.json'))
const QRCode = require('qrcode')
const jsQR = require('jsqr')
const sharp = require('sharp')

const C = { light: '#FFFFFF', dark: '#68001F', eye: '#C82070', plate: '#68001F', plateBorder: '#FFFFFF' }
const SIZE = 2520
const QUIET = 4 // modules of quiet zone on each side

const qr = QRCode.create(url, { errorCorrectionLevel: 'H' })
const n = qr.modules.size
const cell = SIZE / (n + QUIET * 2)
const at = (i) => (i + QUIET) * cell

// Centre plate: a square covering ~11% of the code area (H tolerates 30% damage).
// Centre plate shaped like the logo (square for a mark, wide for lettering), covering ≤ ~12% of the code
// (H tolerates 30% damage). Sides are odd module counts so the plate centres on a module.
const logoMeta = await sharp(await sharp(logoPath).trim().toBuffer()).metadata()
const aspect = Math.min(3, Math.max(1, logoMeta.width / logoMeta.height))
const odd = (x) => Math.max(3, Math.floor(x) | 1)
const plateH = odd(Math.sqrt((0.12 * n * n) / aspect))
const plateW = odd(Math.min(n - 16, Math.floor((0.12 * n * n) / plateH))) // stays clear of the finder eyes
const r0 = (n - plateH) / 2
const c0 = (n - plateW) / 2
const inPlate = (r, c) => r >= r0 - 0.5 && r < r0 + plateH - 0.5 && c >= c0 - 0.5 && c < c0 + plateW - 0.5
const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

let rects = ''
for (let r = 0; r < n; r++) {
  for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c) || inEye(r, c) || inPlate(r, c)) continue
    // Slight overlap so neighbouring modules touch (no hairline gaps when scaled).
    rects += `<rect x="${at(c).toFixed(2)}" y="${at(r).toFixed(2)}" width="${(cell + 0.6).toFixed(2)}" height="${(cell + 0.6).toFixed(2)}"/>`
  }
}

// Finder eyes: burgundy outer ring, magenta centre.
const eye = (r, c) => {
  const x = at(c), y = at(r)
  return (
    `<path fill="${C.dark}" fill-rule="evenodd" d="M${x} ${y}h${7 * cell}v${7 * cell}h${-7 * cell}z M${x + cell} ${y + cell}v${5 * cell}h${5 * cell}v${-5 * cell}z"/>` +
    `<rect fill="${C.eye}" x="${x + 2 * cell}" y="${y + 2 * cell}" width="${3 * cell}" height="${3 * cell}"/>`
  )
}

const plateX = at(c0), plateY = at(r0), plateWpx = plateW * cell, plateHpx = plateH * cell
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="100%" height="100%" fill="${C.light}"/>
<g fill="${C.dark}">${rects}</g>
${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}
<rect x="${plateX + cell * 0.4}" y="${plateY + cell * 0.4}" width="${plateWpx - cell * 0.8}" height="${plateHpx - cell * 0.8}" rx="${cell * 1.6}" fill="${C.plate}" stroke="${C.plateBorder}" stroke-width="${cell * 0.5}"/>
</svg>`

const boxW = Math.round(plateWpx * 0.78), boxH = Math.round(plateHpx * 0.7)
const logo = await sharp(logoPath).trim().resize(boxW, boxH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
const png = await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: Math.round(plateX + (plateWpx - boxW) / 2), top: Math.round(plateY + (plateHpx - boxH) / 2) }])
  .png()
  .toBuffer()
await sharp(png).toFile(outPath)
const plateShare = (plateW * plateH) / (n * n)
console.log(`wrote ${outPath}: ${SIZE}px, version ${qr.version}, ${n}×${n} modules, plate ${(plateShare * 100).toFixed(1)}% of the code area`)

// Verify decoding.
async function decode(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null
}
let failed = 0
const check = async (label, buf) => {
  const got = await decode(buf)
  const ok = got === url
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(got)})`}`)
}
for (const px of [2520, 1500, 1000, 600, 300, 200, 140]) await check(`${px}px`, await sharp(png).resize(px, px).png().toBuffer())
const photo = await sharp(png).resize(700, 700).rotate(9, { background: '#ffffff' }).blur(2).modulate({ brightness: 0.85 }).png().toBuffer()
await check('blurred, rotated 9°, darker (phone photo)', photo)
process.exit(failed ? 1 : 0)
