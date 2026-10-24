'use client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  CsvParseResult,
  parseExpenseCsv,
  parseGroupBackup,
} from '@/lib/import-backup'
import { trpc } from '@/trpc/client'
import { Download, Loader2, RotateCcw, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ImportExportCard({ groupId }: { groupId: string }) {
  const t = useTranslations('ImportExport')
  const router = useRouter()
  const utils = trpc.useUtils()

  const [backupOpen, setBackupOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csv, setCsv] = useState<CsvParseResult | null>(null)
  const [csvFileName, setCsvFileName] = useState<string | null>(null)

  const utilsClient = trpc.useUtils()
  const restore = trpc.groups.import.restore.useMutation()
  const importCsv = trpc.groups.import.csv.useMutation()

  const downloadBackup = async () => {
    setBusy(true)
    setError(null)
    try {
      const { backup } = await utilsClient.groups.import.backup.fetch({
        groupId,
      })
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `spliit-backup-${backup.group.name.replace(/[^\w.-]+/g, '_')}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('errors.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const restoreFromFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      // Categories are global, so any id in the file must exist here.
      const { categories } = await utilsClient.categories.list.fetch()
      const categoryIds = new Set<number>(
        categories.map((category) => category.id),
      )
      const parsed = parseGroupBackup(text, { categoryIds })
      if (!parsed.ok) {
        setError(t(`errors.${parsed.error}`))
        return
      }
      const result = await restore.mutateAsync(parsed.backup)
      setBackupOpen(false)
      await utils.groups.list.invalidate()
      router.push(`/groups/${result.groupId}`)
    } catch {
      setError(t('errors.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  const previewCsv = async (file: File) => {
    setError(null)
    setCsvFileName(file.name)
    const parsed = parseExpenseCsv(await file.text())
    setCsv(parsed)
  }

  const runCsvImport = async () => {
    if (!csv || csv.rows.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await importCsv.mutateAsync({
        groupId,
        rows: csv.rows,
      })
      await utils.groups.expenses.invalidate()
      await utils.groups.stats.invalidate()
      setCsvOpen(false)
      setCsv(null)
      if (result.skipped.length > 0) {
        setError(
          t('errors.partialImport', {
            created: result.created,
            skipped: result.skipped.length,
          }),
        )
      }
    } catch {
      setError(t('errors.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadBackup} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t('exportBackup')}
          </Button>

          <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('restoreBackup')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('restoreBackup')}</DialogTitle>
                <DialogDescription>{t('restoreDescription')}</DialogDescription>
              </DialogHeader>
              <Input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void restoreFromFile(file)
                }}
                disabled={busy}
              />
            </DialogContent>
          </Dialog>

          <Dialog
            open={csvOpen}
            onOpenChange={(open) => {
              setCsvOpen(open)
              if (!open) {
                setCsv(null)
                setCsvFileName(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                {t('importCsv')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('importCsv')}</DialogTitle>
                <DialogDescription>{t('csvDescription')}</DialogDescription>
              </DialogHeader>
              <Input
                type="file"
                accept="text/csv,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void previewCsv(file)
                }}
                disabled={busy}
              />
              {csv && (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-muted-foreground">
                    {t('preview', {
                      file: csvFileName ?? '',
                      rows: csv.rows.length,
                      errors: csv.errors.length,
                    })}
                  </p>
                  {csv.errors.length > 0 && (
                    <ul className="max-h-32 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                      {csv.errors.slice(0, 10).map((row) => (
                        <li key={`${row.line}-${row.message}`}>
                          {t('line', { line: row.line })}:{' '}
                          {t(`errors.${row.message}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {csv.rows.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-1 text-left">{t('date')}</th>
                            <th className="p-1 text-left">
                              {t('titleColumn')}
                            </th>
                            <th className="p-1 text-left">{t('paidBy')}</th>
                            <th className="p-1 text-right">{t('amount')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csv.rows.slice(0, 50).map((row, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-1">{row.date}</td>
                              <td className="p-1">{row.title}</td>
                              <td className="p-1">{row.paidBy}</td>
                              <td className="p-1 text-right tabular-nums">
                                {(row.amount / 100).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button
                    onClick={runCsvImport}
                    disabled={busy || csv.rows.length === 0}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('confirmImport', { count: csv.rows.length })}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
