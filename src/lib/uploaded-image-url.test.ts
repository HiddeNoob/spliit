var mockEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
}

jest.mock('./env', () => ({
  get env() {
    return mockEnv
  },
  get effectiveBaseUrl() {
    return mockEnv.BASE_URL ?? mockEnv.NEXT_PUBLIC_BASE_URL
  },
}))

import { isAllowedUploadUrl } from './uploaded-image-url'

describe('isAllowedUploadUrl', () => {
  beforeEach(() => {
    mockEnv = { NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' }
  })

  it('allows a relative upload URL produced by this app', () => {
    expect(isAllowedUploadUrl('/api/uploads/abcdefghijklmnopqrst.jpg')).toBe(
      true,
    )
  })

  it('allows an absolute URL on this deployment', () => {
    expect(
      isAllowedUploadUrl(
        'http://localhost:3000/api/uploads/abcdefghijklmnopqrst.jpg',
      ),
    ).toBe(true)
  })

  it('honours a runtime BASE_URL override', () => {
    mockEnv = { BASE_URL: 'https://spliit.example.com' }
    expect(
      isAllowedUploadUrl(
        'https://spliit.example.com/api/uploads/abcdefghijklmnopqrst.jpg',
      ),
    ).toBe(true)
  })

  it('rejects another host (SSRF / denial-of-wallet attempt)', () => {
    expect(
      isAllowedUploadUrl(
        'https://evil.example/api/uploads/abcdefghijklmnopqrst.jpg',
      ),
    ).toBe(false)
  })

  it('rejects paths outside the upload route', () => {
    expect(isAllowedUploadUrl('/etc/passwd')).toBe(false)
    expect(
      isAllowedUploadUrl('https://localhost:3000/api/uploads/../x.jpg'),
    ).toBe(false)
  })

  it('rejects a file name that could traverse directories', () => {
    expect(isAllowedUploadUrl('/api/uploads/..%2F..%2Fsecret.jpg')).toBe(false)
    expect(isAllowedUploadUrl('/api/uploads/short.jpg')).toBe(false)
  })

  it('rejects unsupported protocols and malformed input', () => {
    expect(isAllowedUploadUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedUploadUrl('not a url')).toBe(false)
  })
})
