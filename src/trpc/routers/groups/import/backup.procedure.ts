import { getGroupBackup } from '@/lib/import-backup-api'
import { baseProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

export const getGroupBackupProcedure = baseProcedure
  .input(z.object({ groupId: z.string().min(1) }))
  .query(async ({ input: { groupId } }) => {
    const backup = await getGroupBackup(groupId)
    if (!backup) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' })
    }
    return { backup }
  })
