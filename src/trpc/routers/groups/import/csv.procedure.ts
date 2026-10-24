import { importCsvExpenses } from '@/lib/import-backup-api'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

const csvRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  amount: z.number().int(),
  paidBy: z.string().min(1),
  paidFor: z.array(z.string().min(1)).min(1).max(200),
  shares: z.array(z.number().int().min(1)).min(1).max(200),
  category: z.string().max(200).default(''),
  notes: z.string().max(2000).optional(),
})

export const importGroupExpensesCsvProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      rows: z.array(csvRowSchema).min(1).max(5000),
    }),
  )
  .mutation(async ({ input: { groupId, rows } }) => {
    return importCsvExpenses(groupId, rows)
  })
