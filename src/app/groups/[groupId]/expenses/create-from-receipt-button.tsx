'use client'

import { CategoryIcon } from '@/app/groups/[groupId]/expenses/category-icon'
import {
  ReceiptExtractedInfo,
  extractExpenseInformationFromImage,
} from '@/app/groups/[groupId]/expenses/create-from-receipt-button-actions'
import { CameraCaptureDialog } from '@/components/camera-capture-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'
import { useAnalytics } from '@/lib/analytics/context'
import { useMediaQuery } from '@/lib/hooks'
import { saveReceiptDraft } from '@/lib/receipt-draft'
import { FileInput, getImageData, useImageUpload } from '@/lib/use-image-upload'
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  getCurrencyFromGroup,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import {
  Camera,
  ChevronRight,
  FileQuestion,
  Image as ImageIcon,
  Loader2,
  Receipt,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { PropsWithChildren, ReactNode, useState } from 'react'
import { useCurrentGroup } from '../current-group-context'

// Originals may be large phone photos; they are downscaled before upload.
const MAX_FILE_SIZE = 25 * 1024 ** 2

export function CreateFromReceiptButton() {
  const t = useTranslations('CreateFromReceipt')
  const isDesktop = useMediaQuery('(min-width: 640px)')

  const DialogOrDrawer = isDesktop
    ? CreateFromReceiptDialog
    : CreateFromReceiptDrawer

  return (
    <DialogOrDrawer
      trigger={
        <Button
          size="icon"
          variant="secondary"
          title={t('Dialog.triggerTitle')}
        >
          <Receipt className="w-4 h-4" />
        </Button>
      }
      title={
        <>
          <span>{t('Dialog.title')}</span>
          <Badge className="bg-pink-700 hover:bg-pink-600 dark:bg-pink-500 dark:hover:bg-pink-600">
            Beta
          </Badge>
        </>
      }
      description={<>{t('Dialog.description')}</>}
    >
      <ReceiptDialogContent />
    </DialogOrDrawer>
  )
}

function ReceiptDialogContent() {
  const { groupId, group } = useCurrentGroup()
  const sendEvent = useAnalytics()
  const { data: categoriesData } = trpc.categories.list.useQuery()
  const categories = categoriesData?.categories

  const locale = useLocale()
  const t = useTranslations('CreateFromReceipt')
  const [pending, setPending] = useState(false)
  const { inputRef, uploadFile, openFileDialog } = useImageUpload()
  const { toast } = useToast()
  const router = useRouter()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [receiptInfo, setReceiptInfo] = useState<
    | null
    | (ReceiptExtractedInfo & { url: string; width?: number; height?: number })
  >(null)
  const items = receiptInfo?.items ?? []
  const itemsTotal =
    receiptInfo && items.length > 0
      ? items.reduce(
          (sum, item) => sum + Math.round(item.unitPrice * item.quantity * 100),
          0,
        ) / 100
      : null

  const handleFileChange = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t('TooBigToast.title'),
        description: t('TooBigToast.description', {
          maxSize: formatFileSize(MAX_FILE_SIZE, locale),
          size: formatFileSize(file.size, locale),
        }),
        variant: 'destructive',
      })
      return
    }

    const upload = async () => {
      sendEvent(
        { event: 'expense: scan receipt', props: {} },
        `/groups/${groupId}/expenses`,
      )
      try {
        setPending(true)
        console.log('Uploading image…')
        const { url } = await uploadFile(file)
        console.log('Extracting information from receipt…')
        const extracted = await extractExpenseInformationFromImage(url)
        const { width, height } = await getImageData(file)
        setReceiptInfo({ ...extracted, url, width, height })
      } catch (err) {
        console.error(err)
        toast({
          title: t('ErrorToast.title'),
          description: t('ErrorToast.description'),
          variant: 'destructive',
          action: (
            <ToastAction
              altText={t('ErrorToast.retry')}
              onClick={() => upload()}
            >
              {t('ErrorToast.retry')}
            </ToastAction>
          ),
        })
      } finally {
        setPending(false)
      }
    }
    upload()
  }

  const receiptInfoCategory =
    (receiptInfo?.categoryId &&
      categories?.find((c) => String(c.id) === receiptInfo.categoryId)) ||
    null

  return (
    <div className="prose prose-sm dark:prose-invert">
      <p>{t('Dialog.body')}</p>
      <div>
        <FileInput
          inputRef={inputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
        />
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            type="button"
            className="relative h-48 w-full overflow-hidden p-0"
            title={t('Dialog.selectImage')}
            onClick={() => setCameraOpen(true)}
            disabled={pending}
          >
            {pending ? (
              <span className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs text-muted-foreground">
                  {t('Dialog.scanning')}
                </span>
              </span>
            ) : receiptInfo ? (
              <NextImage
                src={receiptInfo.url}
                width={receiptInfo.width ?? 600}
                height={receiptInfo.height ?? 800}
                className="h-full w-full object-contain"
                alt={t('Dialog.previewAlt')}
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Camera className="h-6 w-6" />
                {t('Dialog.selectImage')}
              </span>
            )}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="mr-1.5 h-4 w-4" />
              {t('Dialog.takePhoto')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={openFileDialog}
            >
              <ImageIcon className="mr-1.5 h-4 w-4" />
              {t('Dialog.chooseFile')}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <div className="col-span-2">
              <strong>{t('Dialog.titleLabel')}</strong>
              <div>
                {receiptInfo ? (receiptInfo.title ?? <Unknown />) : '…'}
              </div>
            </div>
            <div className="col-span-2">
              <strong>{t('Dialog.categoryLabel')}</strong>
              <div>
                {receiptInfo ? (
                  receiptInfoCategory ? (
                    <div className="flex items-center">
                      <CategoryIcon
                        category={receiptInfoCategory}
                        className="inline w-4 h-4 mr-2"
                      />
                      <span className="mr-1">
                        {receiptInfoCategory.grouping}
                      </span>
                      <ChevronRight className="inline w-3 h-3 mr-1" />
                      <span>{receiptInfoCategory.name}</span>
                    </div>
                  ) : (
                    <Unknown />
                  )
                ) : (
                  ''
                )}
              </div>
            </div>
            <div>
              <strong>{t('Dialog.amountLabel')}</strong>
              <div>
                {receiptInfo && group ? (
                  receiptInfo.amount ? (
                    <>
                      {formatCurrency(
                        getCurrencyFromGroup(group),
                        receiptInfo.amount,
                        locale,
                        true,
                      )}
                    </>
                  ) : (
                    <Unknown />
                  )
                ) : (
                  '…'
                )}
              </div>
            </div>
            <div>
              <strong>{t('Dialog.dateLabel')}</strong>
              <div>
                {receiptInfo ? (
                  receiptInfo.date ? (
                    formatDate(
                      new Date(`${receiptInfo?.date}T12:00:00.000Z`),
                      locale,
                      { dateStyle: 'medium' },
                    )
                  ) : (
                    <Unknown />
                  )
                ) : (
                  '…'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {receiptInfo && items.length > 0 && (
        <div className="not-prose mt-4">
          <div className="flex items-baseline justify-between">
            <strong className="text-sm">
              {t('Dialog.itemsLabel', { count: items.length })}
            </strong>
            {itemsTotal !== null && group && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(
                  getCurrencyFromGroup(group),
                  itemsTotal,
                  locale,
                  true,
                )}
              </span>
            )}
          </div>
          <ul className="mt-2 divide-y rounded-md border text-sm">
            {items.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-3 px-3 py-1.5"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.quantity} ×{' '}
                  {group
                    ? formatCurrency(
                        getCurrencyFromGroup(group),
                        item.unitPrice,
                        locale,
                        true,
                      )
                    : item.unitPrice}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>{t('Dialog.editNext')}</p>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          // Reuse the normal upload + extraction path.
          void handleFileChange(file)
        }}
      />
      <div className="text-center">
        <Button
          disabled={pending || !receiptInfo}
          onClick={() => {
            if (!receiptInfo || !group) return
            sendEvent(
              { event: 'expense: create from receipt', props: {} },
              `/groups/${groupId}/expenses`,
            )
            const draftId = saveReceiptDraft({
              title: receiptInfo.title,
              amount: receiptInfo.amount,
              categoryId: receiptInfo.categoryId,
              date: receiptInfo.date,
              merchant: receiptInfo.merchant,
              items: receiptInfo.items,
              imageUrl: receiptInfo.url,
              imageWidth: receiptInfo.width,
              imageHeight: receiptInfo.height,
            })
            router.push(
              `/groups/${group.id}/expenses/create?receiptDraft=${encodeURIComponent(
                draftId,
              )}`,
            )
          }}
        >
          {t('Dialog.continue')}
        </Button>
      </div>
    </div>
  )
}

function Unknown() {
  const t = useTranslations('CreateFromReceipt')
  return (
    <div className="flex gap-1 items-center text-muted-foreground">
      <FileQuestion className="w-4 h-4" />
      <em>{t('unknown')}</em>
    </div>
  )
}

function CreateFromReceiptDialog({
  trigger,
  title,
  description,
  children,
}: PropsWithChildren<{
  trigger: ReactNode
  title: ReactNode
  description: ReactNode
}>) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CreateFromReceiptDrawer({
  trigger,
  title,
  description,
  children,
}: PropsWithChildren<{
  trigger: ReactNode
  title: ReactNode
  description: ReactNode
}>) {
  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">{title}</DrawerTitle>
          <DrawerDescription className="text-left">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}
