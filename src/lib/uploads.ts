import { randomId } from '@/lib/random'
import { UPLOAD_FILE_NAME_PATTERN, UPLOAD_URL_PREFIX } from '@/lib/upload-paths'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Local file storage for receipt and expense images.
 *
 * The upstream project stores these in S3 and hands the browser a presigned
 * upload URL. A self-hosted instance does not need an external object store for
 * a handful of receipt photos, and keeping the files on disk means:
 *  - no bucket policy, CORS rules or public-read exposure to configure,
 *  - the AI provider receives the image bytes directly from this server,
 *    so the storage never has to be reachable from the internet.
 *
 * Files are addressed by an unguessable id, which is what the `/api/uploads`
 * route serves. The id is validated against a strict pattern before it touches
 * the filesystem, so a crafted URL cannot escape the upload directory.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 ** 2

/** Only these formats are accepted; they are what browsers and the model handle. */
const EXTENSIONS_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

export function getUploadDirectory(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
}

export class UnsupportedUploadError extends Error {}

/**
 * Stores an image and returns the URL the browser (and the receipt flow) can use.
 * The caller is responsible for enforcing the feature flag and, for the
 * receipt flow, that the upload came from this app.
 */
export async function saveUpload(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ url: string; fileName: string }> {
  const extension = EXTENSIONS_BY_MIME[mimeType]
  if (!extension) {
    throw new UnsupportedUploadError(`Unsupported image type: ${mimeType}`)
  }
  if (bytes.byteLength === 0) {
    throw new UnsupportedUploadError('The uploaded file is empty.')
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedUploadError('The uploaded file is too large.')
  }

  const fileName = `${randomId()}.${extension}`
  const directory = getUploadDirectory()
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, fileName), bytes)
  return { url: `${UPLOAD_URL_PREFIX}${fileName}`, fileName }
}

export type StoredUpload = { bytes: Buffer; contentType: string }

/** Reads a stored image, or null when the name is invalid or unknown. */
export async function readUpload(
  fileName: string,
): Promise<StoredUpload | null> {
  if (!UPLOAD_FILE_NAME_PATTERN.test(fileName)) return null
  const extension = fileName.split('.').pop()!
  const contentType = MIME_BY_EXTENSION[extension]
  if (!contentType) return null

  try {
    const bytes = await readFile(path.join(getUploadDirectory(), fileName))
    return { bytes, contentType }
  } catch {
    return null
  }
}
