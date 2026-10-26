/**
 * Client-side image preparation for receipt uploads.
 *
 * A modern phone photo is 4–12 MB, but a receipt only needs enough resolution
 * to read the printed text. Downscaling and re-encoding in the browser before
 * uploading keeps well under the server limit, makes the AI round-trip much
 * faster, and still leaves the image readable.
 *
 * The decision logic is kept pure so it can be tested without a canvas.
 */

/** Longest side, in pixels, that is worth uploading for reading the receipt. */
export const MAX_IMAGE_DIMENSION = 2200

/** Files at or below this size and dimension are uploaded untouched. */
export const PASSTHROUGH_BYTES = 1.5 * 1024 ** 2

export const JPEG_QUALITY = 0.85

/**
 * Whether an image should be re-encoded. Small images are left alone: decoding
 * and re-encoding them would lose quality for no benefit.
 */
export function shouldCompressImage(input: {
  size: number
  width?: number
  height?: number
  type?: string
}): boolean {
  // Only JPEG/PNG/WebP can be decoded by a canvas. HEIC from an iPhone is sent
  // unchanged, since the browser cannot read it.
  if (input.type && !/^image\/(jpeg|jpg|png|webp)$/i.test(input.type)) {
    return false
  }
  if (input.size > PASSTHROUGH_BYTES) return true
  if (input.width !== undefined && input.width > MAX_IMAGE_DIMENSION)
    return true
  if (input.height !== undefined && input.height > MAX_IMAGE_DIMENSION) {
    return true
  }
  return false
}

/** Target size, preserving the aspect ratio and never upscaling. */
export function getTargetSize(
  width: number,
  height: number,
  maxDimension = MAX_IMAGE_DIMENSION,
): { width: number; height: number } {
  const longestSide = Math.max(width, height)
  if (longestSide <= maxDimension) return { width, height }

  const ratio = maxDimension / longestSide
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

/**
 * Re-encodes a file as a smaller JPEG. Returns the original file when the
 * browser cannot decode it or the result would not be smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === 'undefined') return file

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not read the image.'))
      element.src = url
    })

    if (
      !shouldCompressImage({
        size: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
        type: file.type,
      })
    ) {
      return file
    }

    const target = getTargetSize(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, target.width, target.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob || blob.size >= file.size) return file

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch {
    // An undecodable file is better uploaded as-is than rejected here; the
    // server still validates the size and type.
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
