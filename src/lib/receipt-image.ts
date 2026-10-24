/** Matches the client-side limit in the receipt/document upload inputs. */
export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 ** 2

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/**
 * Downloads an image the app itself uploaded and returns it as a `data:` URL.
 *
 * Two reasons to inline the bytes instead of handing the provider a URL:
 *  - OpenAI-compatible providers (Gemini's compatibility layer among them) do
 *    not all fetch remote image URLs, so a URL may simply be ignored.
 *  - The storage bucket no longer has to be reachable from the public
 *    internet, only from this server.
 *
 * The caller must still validate the URL with `isAllowedUploadUrl` first: this
 * function performs a server-side request, so without that guard it would be
 * an SSRF primitive. Size and content type are re-checked here because the
 * upload bucket may contain files that did not come through the app.
 */
export async function fetchImageAsDataUrl(
  imageUrl: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl?: string,
): Promise<string> {
  // Stored images are served from a relative URL, which `fetch` cannot resolve
  // without a base when running on the server.
  const absoluteUrl =
    imageUrl.startsWith('/') && baseUrl
      ? new URL(imageUrl, baseUrl).toString()
      : imageUrl
  const response = await fetchImpl(absoluteUrl)
  if (!response.ok) {
    throw new Error(`Could not read the uploaded image (${response.status}).`)
  }

  // Trust the declared length when the server sends one, so an oversized file
  // is rejected before it is buffered in memory.
  const declaredLength = Number(response.headers.get('content-length'))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RECEIPT_IMAGE_BYTES
  ) {
    throw new Error('The uploaded image is too large.')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('The uploaded image is empty.')
  }
  if (bytes.byteLength > MAX_RECEIPT_IMAGE_BYTES) {
    throw new Error('The uploaded image is too large.')
  }

  const declaredType = (response.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  const mimeType = ALLOWED_MIME_TYPES.has(declaredType)
    ? declaredType
    : detectImageMimeType(bytes)

  if (!mimeType) {
    throw new Error('The uploaded file is not a supported image.')
  }

  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}

/**
 * Sniffs the magic bytes of the common receipt image formats. Used when the
 * storage provider returns `application/octet-stream` for an object.
 */
export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    // "RIFF" .... "WEBP"
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  // ISO base media file format ("ftyp") covers HEIC/HEIF from iPhones.
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase()
    if (brand.startsWith('heic') || brand.startsWith('heix'))
      return 'image/heic'
    if (brand.startsWith('mif1') || brand.startsWith('msf1'))
      return 'image/heif'
  }
  return null
}
