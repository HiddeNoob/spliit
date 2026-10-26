/**
 * Camera helpers for capturing a receipt photo directly in the browser.
 *
 * The browser's `getUserMedia` API only exists in a secure context (HTTPS or
 * localhost), so callers must fall back to a file input with
 * `capture="environment"` when it is unavailable — for example when the app is
 * opened over plain HTTP on a LAN address.
 */

export type CameraFacing = 'environment' | 'user'

/** The rear camera is what you point at a receipt. */
export const DEFAULT_FACING: CameraFacing = 'environment'

/**
 * Asks for a high-resolution rear camera. `ideal` (rather than `exact`) keeps
 * the request working on devices that only have one camera or cannot do the
 * requested resolution.
 */
export function getCameraConstraints(
  facing: CameraFacing = DEFAULT_FACING,
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  }
}

/** Whether this browser/environment can open a camera stream at all. */
export function isCameraAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

/** A user-facing reason a camera stream could not be opened. */
export type CameraErrorReason =
  'notSupported' | 'permissionDenied' | 'notFound' | 'inUse' | 'unknown'

/**
 * Maps a `getUserMedia` rejection to a short reason the UI can translate.
 * Browsers report these with different names, hence the name checks.
 */
export function getCameraErrorReason(error: unknown): CameraErrorReason {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permissionDenied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'notFound'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'inUse'
    case 'NotSupportedError':
    case 'TypeError':
      return 'notSupported'
    default:
      return 'unknown'
  }
}

/**
 * Captures the current video frame as a JPEG file.
 *
 * `video.videoWidth` is the actual decoded frame size, which is what should be
 * used rather than the element's CSS size. Returns null while the stream has
 * not produced a frame yet.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  options: { quality?: number; fileName?: string } = {},
): Promise<File | null> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(video, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', options.quality ?? 0.92),
  )
  if (!blob) return null

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return new File([blob], options.fileName ?? `receipt-${timestamp}.jpg`, {
    type: 'image/jpeg',
  })
}

/** Stops every track so the camera light turns off when the dialog closes. */
export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}
