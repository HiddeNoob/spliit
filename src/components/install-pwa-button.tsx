'use client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMediaQuery } from '@/lib/hooks'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/** Dismissal is versioned so a redesign can ask again. */
const DISMISS_KEY = 'spliit-install-prompt-dismissed-v1'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag instead of display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  )
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Offers to install the app on the home screen. Chrome/Android fire
 * `beforeinstallprompt`, which we defer and replay on click. Browsers without
 * it (notably iOS Safari) get short instructions instead.
 */
export function InstallPwaButton() {
  const t = useTranslations('Pwa.Install')
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true)
  const [dismissed, setDismissed] = useState(true)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === 'true')

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === 'true')
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || dismissed) return null
  // On iOS there is no prompt event: show the button anyway so the
  // instructions can be reached.
  if (!promptEvent && !isIos()) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // Storage may be unavailable; the prompt simply comes back next visit.
    }
  }

  const install = async () => {
    if (!promptEvent) {
      setShowIosHelp(true)
      return
    }
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{t('banner')}</span>
        <Button size="sm" variant="secondary" onClick={install}>
          {t('action')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={t('dismiss')}
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('iosTitle')}</DialogTitle>
            <DialogDescription>{t('iosDescription')}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>{t('iosStepShare')}</span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>{t('iosStepAdd')}</span>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            {isDesktop ? t('iosDesktopNote') : t('iosNote')}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
