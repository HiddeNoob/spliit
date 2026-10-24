import { createTRPCRouter } from '@/trpc/init'
import { deleteGroupBudgetProcedure } from '@/trpc/routers/groups/budgets/delete.procedure'
import { listGroupBudgetsProcedure } from '@/trpc/routers/groups/budgets/list.procedure'
import { upsertGroupBudgetProcedure } from '@/trpc/routers/groups/budgets/upsert.procedure'

export const groupBudgetsRouter = createTRPCRouter({
  list: listGroupBudgetsProcedure,
  upsert: upsertGroupBudgetProcedure,
  delete: deleteGroupBudgetProcedure,
})
