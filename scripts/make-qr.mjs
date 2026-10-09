#!/usr/bin/env node
// Branded registration QR: error correction H, solid (touching) modules, a centre logo plate covering
// about 11% of the code, wine modules on ivory. Then it proves the result decodes (jsQR) at print and
// thumbnail sizes, plus a blurred, rotated "phone photo" copy. Exits non-zero if any decode fails.
//
// Its libraries are kept out of the app's dependencies: install them in a scratch folder and point at it.
//   mkdir -p /tmp/qr-tool && (cd /tmp/qr-tool && npm init -y && npm i qrcode@1.5.4 jsqr@1.4.0 sharp@0.34.3)
//   QR_TOOL_DIR=/tmp/qr-tool node scripts/make-qr.mjs https://<production-url>/?src=qr brand/clc-logo.png docs/launch/wives-hangout-qr.png
// Colours mirror src/styles/theme.css (re-run with the flyer logo and palette in M3).

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

const C = { light: '#FBF5EE', dark: '#5A1A30', eye: '#7A571B', plateBorder: '#D4AF62' }
const SIZE = 2520
const QUIET = 4 // modules of quiet zone on each side

const qr = QRCode.create(url, { errorCorrectionLevel: 'H' })
const n = qr.modules.size
const cell = SIZE / (n + QUIET * 2)
const at = (i) => (i + QUIET) * cell

// Centre plate: a square covering ~11% of the code area (H tolerates 30% damage).
const plateModules = Math.floor(Math.sqrt(0.11) * n) | 1 // odd, so it centres on a module
const p0 = (n - plateModules) / 2
const inPlate = (r, c) => r >= p0 - 0.5 && r < p0 + plateModules - 0.5 && c >= p0 - 0.5 && c < p0 + plateModules - 0.5
const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

let rects = ''
for (let r = 0; r < n; r++) {
  for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c) || inEye(r, c) || inPlate(r, c)) continue
    // Slight overlap so neighbouring modules touch (no hairline gaps when scaled).
    rects += `<rect x="${at(c).toFixed(2)}" y="${at(r).toFixed(2)}" width="${(cell + 0.6).toFixed(2)}" height="${(cell + 0.6).toFixed(2)}"/>`
  }
}

// Finder eyes: wine outer ring, gold-700 centre.
const eye = (r, c) => {
  const x = at(c), y = at(r)
  return (
    `<path fill="${C.dark}" fill-rule="evenodd" d="M${x} ${y}h${7 * cell}v${7 * cell}h${-7 * cell}z M${x + cell} ${y + cell}v${5 * cell}h${5 * cell}v${-5 * cell}z"/>` +
    `<rect fill="${C.eye}" x="${x + 2 * cell}" y="${y + 2 * cell}" width="${3 * cell}" height="${3 * cell}"/>`
  )
}

const plateX = at(p0) , plateSide = plateModules * cell
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="100%" height="100%" fill="${C.light}"/>
<g fill="${C.dark}">${rects}</g>
${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}
<rect x="${plateX + cell * 0.4}" y="${plateX + cell * 0.4}" width="${plateSide - cell * 0.8}" height="${plateSide - cell * 0.8}" rx="${cell * 1.6}" fill="${C.light}" stroke="${C.plateBorder}" stroke-width="${cell * 0.35}"/>
</svg>`

const logoBox = Math.round(plateSide * 0.74)
const logo = await sharp(logoPath).trim().resize(logoBox, logoBox, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
const offset = Math.round(plateX + (plateSide - logoBox) / 2)
const png = await sharp(Buffer.from(svg)).composite([{ input: logo, left: offset, top: offset }]).png().toBuffer()
await sharp(png).toFile(outPath)
const plateShare = (plateModules / n) ** 2
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
