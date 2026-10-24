var mockEnv: Record<string, string | undefined> = {}

jest.mock('./env', () => ({
  get env() {
    return mockEnv
  },
}))

import { extractTextWithOcr } from './ocr'

function response(body: string, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response
}

describe('extractTextWithOcr', () => {
  beforeEach(() => {
    mockEnv = {
      OCR_API_URL: 'https://ocr.test/v1/ocr',
      OCR_API_KEY: 'test-key',
      OCR_MODEL: 'deepseek-ocr-2',
    }
  })

  it('posts the image and returns the recognised text', async () => {
    const fetchImpl = jest.fn(async () =>
      response(JSON.stringify({ model: 'deepseek-ocr-2', text: 'TOPLAM 10' })),
    )

    const result = await extractTextWithOcr('data:image/jpeg;base64,AAA', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result).toEqual({ text: 'TOPLAM 10', model: 'deepseek-ocr-2' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://ocr.test/v1/ocr')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe(
      'test-key',
    )
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'deepseek-ocr-2',
      image: 'data:image/jpeg;base64,AAA',
    })
  })

  it('fails when the service is not configured', async () => {
    mockEnv = {}
    await expect(
      extractTextWithOcr('data:image/jpeg;base64,AAA'),
    ).rejects.toThrow('OCR API is not configured.')
  })

  it('surfaces the service error', async () => {
    const fetchImpl = jest.fn(async () =>
      response('{"error":"invalid key"}', { status: 401 }),
    )
    await expect(
      extractTextWithOcr('data:image/jpeg;base64,AAA', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OCR request failed \(401\)/)
  })

  it('rejects a response without text', async () => {
    const fetchImpl = jest.fn(async () => response('{}'))
    await expect(
      extractTextWithOcr('data:image/jpeg;base64,AAA', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('OCR response did not contain text.')
  })
})
