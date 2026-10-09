/**
 * Normalises a Nigerian mobile number to the 11-digit local form (0XXXXXXXXXX).
 * Accepts +234…, 234…, 0… and the bare 10-digit form, with spaces, dashes,
 * dots or brackets. Returns null if it isn't a plausible Nigerian mobile number.
 *
 * Duplicate detection depends on this: "+234 801 234 5678" and "08012345678"
 * must normalise to the same value.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const stripped = input.trim().replace(/[\s\-().]/g, '')
  let digits: string

  if (/^\+234\d{10}$/.test(stripped)) digits = '0' + stripped.slice(4)
  else if (/^234\d{10}$/.test(stripped)) digits = '0' + stripped.slice(3)
  else if (/^0\d{10}$/.test(stripped)) digits = stripped
  else if (/^[789]\d{9}$/.test(stripped)) digits = '0' + stripped
  else return null

  // Mobile ranges: 070x, 080x, 081x, 090x, 091x
  return /^0[789][01]\d{8}$/.test(digits) ? digits : null
}
