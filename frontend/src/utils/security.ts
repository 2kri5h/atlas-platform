/**
 * Security and URL sanitization helpers.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Validates whether a URL is safe to use in href attributes.
 * Prevents javascript:, data:, vbscript: and other malicious schemes.
 */
export function isSafeUrl(url?: string | null): boolean {
  if (!url) return false
  const trimmed = url.trim()
  // Allow relative URLs starting with / or #
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    // Disallow protocol-relative URLs like '//malicious.com'
    return !trimmed.startsWith('//')
  }
  try {
    // If it doesn't have a protocol (e.g. "www.google.com"), check if it looks like a domain
    let toParse = trimmed
    if (!toParse.includes('://') && !toParse.startsWith('mailto:') && !toParse.startsWith('tel:')) {
      toParse = `https://${toParse}`
    }
    const parsed = new URL(toParse)
    return SAFE_PROTOCOLS.has(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Sanitizes a URL for safe navigation.
 * Returns the URL if safe, or a fallback URL ('#' or provided fallback) if dangerous.
 */
export function sanitizeUrl(url?: string | null, fallback = '#'): string {
  if (!url) return fallback
  const trimmed = url.trim()
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    if (!trimmed.startsWith('//')) {
      return trimmed
    }
    return fallback
  }

  try {
    let toParse = trimmed
    if (!toParse.includes('://') && !toParse.startsWith('mailto:') && !toParse.startsWith('tel:')) {
      toParse = `https://${toParse}`
    }
    const parsed = new URL(toParse)
    if (SAFE_PROTOCOLS.has(parsed.protocol)) {
      return toParse
    }
  } catch {
    // Malformed URL
  }
  return fallback
}
