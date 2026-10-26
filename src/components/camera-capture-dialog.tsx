'use client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CameraErrorReason,
  CameraFacing,
  DEFAULT_FACING,
  captureVideoFrame,
  getCameraConstraints,
  getCameraErrorReason,
  isCameraAvailable,
  stopMediaStream,
} from '@/lib/camera'
import { cn } from '@/lib/utils'
import { Camera, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the captured photo; the dialog closes afterwards. */
  onCapture: (file: File) => void
}

/**
 * Full-screen camera capture for receipts.
 *
 * Opens the rear camera by default, shows a live preview and hands back a JPEG
 * of the current frame. Every track is stopped when the dialog closes so the
 * camera indicator does not stay on.
 */
export function CameraCaptureDialog({ open, onOpenChange, onCapture }: Props) {
  const t = useTranslations('Camera')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<CameraFacing>(DEFAULT_FACING)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<CameraErrorReason | null>(null)

  const stop = useCallback(() => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    setReady(false)
  }, [])

  const start = useCallback(
    async (nextFacing: CameraFacing) => {
      stop()
      setError(null)

      if (!isCameraAvailable()) {
        setError('notSupported')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          getCameraConstraints(nextFacing),
        )
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {
            // Autoplay can be blocked until a gesture; the dialog itself is
            // opened by a click, so this is rare and the stream still works.
          })
        }
        setReady(true)
      } catch (err) {
        setError(getCameraErrorReason(err))
      }
    },
    [stop],
  )

  // Start on open, stop on close. Re-running on `facing` lets the switch button
  // reopen the other camera.
  useEffect(() => {
    if (!open) {
      stop()
      return
    }
    void start(facing)
    return () => stop()
  }, [open, facing, start, stop])

  const handleCapture = async () => {
    const video = videoRef.current
    if (!video) return
    setCapturing(true)
    try {
      const file = await captureVideoFrame(video)
      if (!file) {
        setError('unknown')
        return
      }
      onCapture(file)
      onOpenChange(false)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-3 sm:p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base">
            <Camera className="h-4 w-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-black sm:aspect-video">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={cn(
              'h-full w-full object-contain transition-opacity',
              ready ? 'opacity-100' : 'opacity-0',
            )}
          />
          {/* Guide for framing the receipt. */}
          {ready && (
            <div className="pointer-events-none absolute inset-5 rounded border-2 border-dashed border-white/40" />
          )}

          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">{t('starting')}</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
              <Camera className="h-8 w-8 opacity-60" />
              <p className="text-sm">{t(`errors.${error}`)}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void start(facing)}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {t('retry')}
              </Button>
            </div>
          )}

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8"
            aria-label={t('close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute left-2 top-2 h-8 w-8"
            aria-label={t('switchCamera')}
            onClick={() =>
              setFacing((current) =>
                current === 'environment' ? 'user' : 'environment',
              )
            }
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button"
          className="w-full"
          size="lg"
          disabled={!ready || capturing}
          onClick={handleCapture}
        >
          {capturing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Camera className="mr-2 h-5 w-5" />
          )}
          {capturing ? t('capturing') : t('capture')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
