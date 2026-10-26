import { effectiveBaseUrl } from './env'
import { UPLOAD_FILE_NAME_PATTERN, UPLOAD_URL_PREFIX } from './upload-paths'

export { UPLOAD_FILE_NAME_PATTERN, UPLOAD_URL_PREFIX }

/**
 * True for URLs this app produced. Absolute URLs are accepted only when they
 * point at this deployment, which keeps a caller from forwarding an arbitrary
 * URL to the AI provider (SSRF and unbounded API spend).
 */
export function isLocalUploadUrl(rawUrl: string, baseUrl?: string): boolean {
  let pathname: string
  let hostname: string | null = null
  try {
    if (rawUrl.startsWith('/')) {
      pathname = new URL(rawUrl, 'http://localhost').pathname
    } else {
      const url = new URL(rawUrl)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
      pathname = url.pathname
      hostname = url.hostname
    }
  } catch {
    return false
  }

  if (!pathname.startsWith(UPLOAD_URL_PREFIX)) return false
  const fileName = pathname.slice(UPLOAD_URL_PREFIX.length)
  if (!UPLOAD_FILE_NAME_PATTERN.test(fileName)) return false

  if (hostname === null) return true
  if (!baseUrl) return false
  try {
    const base = new URL(baseUrl)
    return base.hostname === hostname
  } catch {
    return false
  }
}

/**
 * True only for images this app itself stored. Used to ensure AI extraction is
 * performed against files the app produced, rather than an arbitrary
 * caller-supplied URL (which would enable SSRF-via-provider and unbounded API
 * spend).
 */
export function isAllowedUploadUrl(rawUrl: string): boolean {
  return isLocalUploadUrl(rawUrl, effectiveBaseUrl)
}
