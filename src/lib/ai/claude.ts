import Anthropic from '@anthropic-ai/sdk'

/** Model for the hat mockup agent and its helper calls (chosen in the plan for speed and cost). */
export const MOCKUP_MODEL = 'claude-sonnet-5-5'

// Server-side fallback: if the model declines, the API re-runs the request on a
// fallback model chosen by refusal category, inside the same call.
export const FALLBACK = {
  betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: 'default' as const,
}

let client: Anthropic | null = null

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export function claude(): Anthropic {
  client ??= new Anthropic()
  return client
}

export class ClaudeRefusal extends Error {
  constructor(public category: string | null) {
    super(`Claude declined the request${category ? ` (${category})` : ''}`)
  }
}

export function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/**
 * One request that must return JSON matching `schema` (structured outputs).
 * Every object in `schema` needs `additionalProperties: false`.
 */
export async function structuredCall<T>({
  system,
  content,
  schema,
  maxTokens = 2000,
  effort = 'low',
}: {
  system: string
  content: Anthropic.Beta.BetaContentBlockParam[] | string
  schema: Record<string, unknown>
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
}): Promise<T> {
  const res = await claude().beta.messages.create({
    model: MOCKUP_MODEL,
    max_tokens: maxTokens,
    ...FALLBACK,
    system,
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw new ClaudeRefusal(res.stop_details?.category ?? null)
  return JSON.parse(textOf(res)) as T
}

export function imageBlock(png: Buffer, mediaType: 'image/png' | 'image/jpeg' = 'image/png'): Anthropic.Beta.BetaImageBlockParam {
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: png.toString('base64') } }
}
