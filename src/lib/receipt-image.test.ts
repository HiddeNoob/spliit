import { detectImageMimeType } from './receipt-image'

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

describe('detectImageMimeType', () => {
  it('detects JPEG', () => {
    expect(detectImageMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(
      'image/jpeg',
    )
  })

  it('detects PNG', () => {
    expect(
      detectImageMimeType(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      ),
    ).toBe('image/png')
  })

  it('detects WebP', () => {
    expect(
      detectImageMimeType(
        bytes(
          0x52,
          0x49,
          0x46,
          0x46,
          0x24,
          0x00,
          0x00,
          0x00,
          0x57,
          0x45,
          0x42,
          0x50,
        ),
      ),
    ).toBe('image/webp')
  })

  it('detects HEIC from an iPhone', () => {
    expect(
      detectImageMimeType(
        bytes(
          0x00,
          0x00,
          0x00,
          0x18,
          0x66,
          0x74,
          0x79,
          0x70,
          0x68,
          0x65,
          0x69,
          0x63,
        ),
      ),
    ).toBe('image/heic')
  })

  it('returns null for unknown data', () => {
    expect(detectImageMimeType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull()
    expect(detectImageMimeType(bytes())).toBeNull()
  })
})
