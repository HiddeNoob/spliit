import { readUpload } from '@/lib/uploads'
import { NextResponse } from 'next/server'

/**
 * Serves a stored receipt/expense image. Ids are unguessable and validated in
 * `readUpload`, so the directory cannot be traversed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string[] }> },
) {
  const { fileName } = await params
  // Only a single path segment is addressable.
  if (fileName.length !== 1) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const upload = await readUpload(fileName[0])
  if (!upload) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(upload.bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': upload.contentType,
      // The file name contains a random id, so the content never changes.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(upload.bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
