'use client'
import { compressImage } from '@/lib/image-compression'
import { RefObject, useCallback, useRef, useState } from 'react'

/**
 * Uploads an image to this app's own `/api/upload` endpoint.
 *
 * Mirrors the small surface the components used from `next-s3-upload`
 * (`FileInput`, `openFileDialog`, an upload function) so the call sites stayed
 * nearly unchanged when local storage replaced S3.
 */
export function useImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setUploading] = useState(false)

  const openFileDialog = useCallback(() => inputRef.current?.click(), [])

  const uploadFile = useCallback(async (file: File) => {
    // Shrink phone photos first: smaller uploads reach the OCR service faster
    // and avoid the server's size limit.
    const prepared = await compressImage(file)
    const formData = new FormData()
    formData.append('file', prepared)
    setUploading(true)
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(detail.error ?? `Upload failed (${response.status}).`)
      }
      const { url } = (await response.json()) as { url: string }
      return { url }
    } finally {
      setUploading(false)
    }
  }, [])

  return { inputRef, openFileDialog, uploadFile, isUploading }
}

/**
 * Reads the pixel dimensions of an image file. Used to store a `next/image`
 * size for the attached receipt thumbnail.
 */
export async function getImageData(
  file: File,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    bitmap.close()
    return { width, height }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not read the image.'))
      element.src = url
    })
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

type FileInputProps = {
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (file: File) => void
  accept?: string
}

/** Hidden file input; open it with the hook's `openFileDialog`. */
export function FileInput({ inputRef, onChange, accept }: FileInputProps) {
  return (
    <input
      type="file"
      accept={accept}
      className="hidden"
      ref={inputRef}
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onChange(file)
        // Allow selecting the same file again after an error.
        event.target.value = ''
      }}
    />
  )
}
