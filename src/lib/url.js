const TRACKING_KEYS = ['fbclid', 'mibextid', 'ref', 'refsrc', '__tn__', 'paipv', 'hrc', 'fs']

export function normalizeListingUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (!/^https?:$/.test(url.protocol)) return null
    url.hash = ''
    TRACKING_KEYS.forEach((key) => url.searchParams.delete(key))
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = url.pathname.replace(/\/+$/, '')
    const query = url.searchParams.toString()
    return `${url.protocol}//${url.hostname}${path}${query ? `?${query}` : ''}`
  } catch {
    return raw.toLowerCase()
  }
}

export function isHttpUrl(input) {
  if (!input) return true
  return /^https?:\/\/.+/i.test(String(input).trim())
}
