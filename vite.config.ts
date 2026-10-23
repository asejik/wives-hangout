import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { EVENT } from './shared/event.js'

// Social previews (WhatsApp, Instagram, X) need absolute URLs. Vercel provides the production
// domain at build time; previews and local builds fall back to their own URL or localhost.
function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  return host ? `https://${host}` : 'http://localhost:3000'
}

/** Content fingerprint for og.jpg: Facebook/WhatsApp cache preview images by URL, so a new image
 *  needs a new URL (found when the event was rescheduled and the old image stuck). */
function ogImageUrl(url: string): string {
  const hash = createHash('sha256').update(readFileSync('public/og.jpg')).digest('hex').slice(0, 10)
  return `${url}/og.jpg?v=${hash}`
}

/** Event JSON-LD. Every field mirrors visible content in shared/event.ts; nothing invented. */
function eventJsonLd(url: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: EVENT.name,
    description: `${EVENT.name} by ${EVENT.host}: ${EVENT.theme}. ${EVENT.date}, ${EVENT.time}, ${EVENT.place.locality}.`,
    startDate: EVENT.schedule.start,
    endDate: EVENT.schedule.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    isAccessibleForFree: true,
    image: [ogImageUrl(url)],
    url: `${url}/`,
    location: {
      '@type': 'Place',
      // City only: the venue is revealed after registering.
      name: EVENT.place.locality,
      address: {
        '@type': 'PostalAddress',
        addressLocality: EVENT.place.locality,
        addressRegion: EVENT.place.region,
        addressCountry: EVENT.place.country,
      },
    },
    organizer: { '@type': 'Organization', name: EVENT.host },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN', availability: 'https://schema.org/InStock', url: `${url}/` },
  }
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const seo = (): Plugin => ({
  name: 'site-seo',
  transformIndexHtml: (html, ctx) => {
    const url = siteUrl()
    let out = html.replaceAll('%OG_IMAGE%', ogImageUrl(url)).replaceAll('%SITE_URL%', url)
    if (ctx.path === '/index.html') out = out.replace('</head>', `    ${eventJsonLd(url)}\n  </head>`)
    return out
  },
  // robots.txt and sitemap.xml need the absolute production URL, so they're generated.
  generateBundle() {
    const url = siteUrl()
    const today = new Date().toISOString().slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n` })
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        ['/', '/privacy'].map((p) => `  <url><loc>${url}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
        '\n</urlset>\n',
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', privacy: 'privacy.html', menu: 'menu.html' },
    },
  },
})
