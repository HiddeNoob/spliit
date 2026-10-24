import {
  getTargetSize,
  MAX_IMAGE_DIMENSION,
  shouldCompressImage,
} from './image-compression'

describe('shouldCompressImage', () => {
  it('leaves small, low-resolution images alone', () => {
    expect(
      shouldCompressImage({
        size: 200_000,
        width: 800,
        height: 600,
        type: 'image/jpeg',
      }),
    ).toBe(false)
  })

  it('compresses a large file', () => {
    expect(
      shouldCompressImage({ size: 6 * 1024 ** 2, type: 'image/jpeg' }),
    ).toBe(true)
  })

  it('compresses an oversized dimension even when the file is small', () => {
    expect(
      shouldCompressImage({
        size: 500_000,
        width: 4000,
        height: 300,
        type: 'image/jpeg',
      }),
    ).toBe(true)
  })

  it('leaves HEIC untouched because a canvas cannot decode it', () => {
    expect(
      shouldCompressImage({ size: 8 * 1024 ** 2, type: 'image/heic' }),
    ).toBe(false)
  })
})

describe('getTargetSize', () => {
  it('keeps images that already fit', () => {
    expect(getTargetSize(1000, 800)).toEqual({ width: 1000, height: 800 })
  })

  it('scales the longest side down and preserves the ratio', () => {
    expect(getTargetSize(4000, 3000)).toEqual({
      width: MAX_IMAGE_DIMENSION,
      height: 1650,
    })
  })

  it('works for portrait images', () => {
    expect(getTargetSize(3000, 4400)).toEqual({
      width: 1500,
      height: MAX_IMAGE_DIMENSION,
    })
  })

  it('never returns a zero dimension', () => {
    const result = getTargetSize(10000, 10)
    expect(result.width).toBe(MAX_IMAGE_DIMENSION)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})
