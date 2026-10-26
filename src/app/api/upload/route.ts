import { getRuntimeFeatureFlags } from '@/lib/featureFlags'
import {
  MAX_UPLOAD_BYTES,
  saveUpload,
  UnsupportedUploadError,
} from '@/lib/uploads'
import { NextResponse } from 'next/server'

/**
 * Receives an image from the browser and stores it on local disk.
 *
 * This replaces the S3 presigned-upload route: a self-hosted instance does not
 * need an object store for receipt photos, and the receipt flow reads the bytes
 * from this server anyway. The upload is gated by the same feature flag as the
 * UI, so disabling expense documents also disables the endpoint.
 */
export async function POST(request: Request) {
  const { enableExpenseDocuments } = await getRuntimeFeatureFlags()
  if (!enableExpenseDocuments) {
    return NextResponse.json(
      { error: 'Expense documents are not enabled.' },
      { status: 403 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large.' }, { status: 413 })
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { url } = await saveUpload(bytes, file.type)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof UnsupportedUploadError) {
      return NextResponse.json({ error: error.message }, { status: 415 })
    }
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }
}
