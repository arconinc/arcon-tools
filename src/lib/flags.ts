import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const expenseReportsFlag = flag<boolean>({
  key: 'expense-reports',
  description: 'Expense Reports feature',
  adapter: vercelAdapter(),
  defaultValue: false,
})

// Wrapper for layout.tsx files — evaluates all flags and returns a plain dict
export async function getEvaluatedFlags(): Promise<Record<string, boolean>> {
  const expenseReports = await expenseReportsFlag()
  return {
    'expense-reports': expenseReports,
  }
}
