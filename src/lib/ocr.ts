import { env } from './env'

export type OcrResult = {
  text: string
  model: string
}

/**
 * Sends an image to the configured OCR service and returns the recognised
 * text.
 *
 * The service is a simple document-OCR endpoint (`POST /v1/ocr` with a JSON
 * `{ model, image }` body, where `image` is a data URL) rather than a chat
 * completion. It returns plain text, which `parseReceiptText` turns into the
 * structured fields the expense form needs.
 *
 * `fetchImpl` is injectable so the tests can run without network access.
 */
export async function extractTextWithOcr(
  imageDataUrl: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<OcrResult> {
  const apiKey = env.OCR_API_KEY
  const apiUrl = env.OCR_API_URL
  if (!apiKey || !apiUrl) {
    throw new Error('OCR API is not configured.')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ model: env.OCR_MODEL, image: imageDataUrl }),
  })

  if (!response.ok) {
    // The body is a small JSON error object from the service; including its
    // text makes a misconfigured key or model obvious in the server log.
    const detail = await response.text().catch(() => '')
    throw new Error(
      `OCR request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    )
  }

  const payload = (await response.json()) as {
    text?: unknown
    model?: unknown
  }
  if (typeof payload.text !== 'string') {
    throw new Error('OCR response did not contain text.')
  }

  return {
    text: payload.text,
    model: typeof payload.model === 'string' ? payload.model : env.OCR_MODEL,
  }
}
