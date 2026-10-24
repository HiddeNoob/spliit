import { groupBackupSchema } from '@/lib/import-backup'
import { restoreGroupBackup } from '@/lib/import-backup-api'
import { baseProcedure } from '@/trpc/init'

export const restoreGroupBackupProcedure = baseProcedure
  .input(groupBackupSchema)
  .mutation(async ({ input }) => {
    return restoreGroupBackup(input)
  })
