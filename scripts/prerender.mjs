// After `vite build` + the SSR build: injects each server-rendered page into its dist HTML file
// and inlines the (small) stylesheet so first paint doesn't wait for a second request on 3G.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const { pages } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url))
const marker = '<div id="root"></div>'

for (const [name, render] of Object.entries(pages)) {
  const file = new URL(`../dist/${name}`, import.meta.url)
  const html = readFileSync(file, 'utf8')
  if (!html.includes(marker)) throw new Error(`prerender: root marker not found in dist/${name}`)
  let out = html.replace(marker, `<div id="root">${render()}</div>`)
  out = out.replace(/<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/, (_, href) => {
    const css = readFileSync(new URL(`../dist${href}`, import.meta.url), 'utf8')
    return `<style>${css}</style>`
  })
  writeFileSync(file, out)
  console.log(`prerendered dist/${name}`)
}
rmSync(new URL('../dist-ssr', import.meta.url), { recursive: true, force: true })
