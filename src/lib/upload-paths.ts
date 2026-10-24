/**
 * Shared, dependency-free constants describing where uploaded images live.
 *
 * Kept apart from `uploaded-image-url.ts` (which reads `env`) so that client
 * code and the shared Zod schemas can use the pattern without pulling the
 * server-only environment into the bundle.
 */

export const UPLOAD_URL_PREFIX = '/api/uploads/'

/** `nanoid` ids are 21 URL-safe characters; the extension is the image format. */
export const UPLOAD_FILE_NAME_PATTERN =
  /^[A-Za-z0-9_-]{10,64}\.(jpg|jpeg|png|webp|heic|heif)$/

/** Matches only a relative upload URL produced by this app. */
export const LOCAL_UPLOAD_URL_PATTERN =
  /^\/api\/uploads\/[A-Za-z0-9_-]{10,64}\.(jpg|jpeg|png|webp|heic|heif)$/
