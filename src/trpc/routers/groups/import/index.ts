import { createTRPCRouter } from '@/trpc/init'
import { getGroupBackupProcedure } from '@/trpc/routers/groups/import/backup.procedure'
import { importGroupExpensesCsvProcedure } from '@/trpc/routers/groups/import/csv.procedure'
import { restoreGroupBackupProcedure } from '@/trpc/routers/groups/import/restore.procedure'

export const groupImportRouter = createTRPCRouter({
  backup: getGroupBackupProcedure,
  restore: restoreGroupBackupProcedure,
  csv: importGroupExpensesCsvProcedure,
})
