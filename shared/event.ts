// Everything specific to this event. To reuse the site for another event, change this file,
// the artwork in public/assets, and the env vars (EVENT_SLUG, close time).
// Used by both the page (src/) and the server (api/).

export const EVENT = {
  name: 'Wives Hangout',
  host: 'Citizens of Light Church',
  /** Privacy requests and questions. */
  contactEmail: 'clcchurchmedia@gmail.com',
  date: 'Saturday, 24 October 2026',
  time: '4PM',
  /** Always shown in full. */
  venue: 'Freedom Place, Ilesanmi Bus Stop, Tanke, Ilorin',
  /** For structured data (SEO). The end time isn't known, so the end is a date only. */
  schedule: { start: '2026-10-24T16:00:00+01:00', endDate: '2026-10-24' },
  place: { name: 'Freedom Place', street: 'Ilesanmi Bus Stop, Tanke', locality: 'Ilorin', region: 'Kwara', country: 'NG' },
} as const
