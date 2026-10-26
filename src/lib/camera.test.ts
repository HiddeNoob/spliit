import { getCameraConstraints, getCameraErrorReason } from './camera'

describe('getCameraConstraints', () => {
  it('asks for the rear camera by default', () => {
    const constraints = getCameraConstraints()
    const video = constraints.video as MediaTrackConstraints
    expect(video.facingMode).toEqual({ ideal: 'environment' })
    expect(constraints.audio).toBe(false)
  })

  it('requests a high-resolution frame', () => {
    const video = getCameraConstraints().video as MediaTrackConstraints
    expect(video.width).toEqual({ ideal: 1920 })
    expect(video.height).toEqual({ ideal: 1080 })
  })

  it('can ask for the front camera', () => {
    const video = getCameraConstraints('user').video as MediaTrackConstraints
    expect(video.facingMode).toEqual({ ideal: 'user' })
  })

  it('uses ideal rather than exact, so single-camera devices still work', () => {
    const video = getCameraConstraints().video as MediaTrackConstraints
    expect(video.facingMode).not.toHaveProperty('exact')
  })
})

describe('getCameraErrorReason', () => {
  it('maps permission errors', () => {
    for (const name of [
      'NotAllowedError',
      'PermissionDeniedError',
      'SecurityError',
    ]) {
      expect(getCameraErrorReason({ name })).toBe('permissionDenied')
    }
  })

  it('maps a missing camera', () => {
    expect(getCameraErrorReason({ name: 'NotFoundError' })).toBe('notFound')
    expect(getCameraErrorReason({ name: 'DevicesNotFoundError' })).toBe(
      'notFound',
    )
  })

  it('maps a camera in use', () => {
    expect(getCameraErrorReason({ name: 'NotReadableError' })).toBe('inUse')
    expect(getCameraErrorReason({ name: 'TrackStartError' })).toBe('inUse')
  })

  it('maps unsupported requests', () => {
    expect(getCameraErrorReason({ name: 'NotSupportedError' })).toBe(
      'notSupported',
    )
    expect(getCameraErrorReason({ name: 'TypeError' })).toBe('notSupported')
  })

  it('falls back to unknown', () => {
    expect(getCameraErrorReason(new Error('boom'))).toBe('unknown')
    expect(getCameraErrorReason(null)).toBe('unknown')
    expect(getCameraErrorReason(undefined)).toBe('unknown')
  })
})
