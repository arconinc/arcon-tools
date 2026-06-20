import { flags } from '@/next.config'

export async function getEvaluatedFlags(): Promise<Record<string, boolean>> {
  try {
    const evaluated = await flags.evaluate()
    return Object.fromEntries(
      Object.entries(evaluated).map(([key, value]) => [key, !!value.value])
    )
  } catch {
    return {}
  }
}
